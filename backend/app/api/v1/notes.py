from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import data_envelope, list_envelope
from app.core.errors import ApiError
from app.models.note import Note
from app.models.user import User
from app.schemas.note import NoteCreate, NotePatch
from app.services.idempotency import get_idempotency_context, store_idempotency_response
from app.services.notes import list_notes, owned_note, project_notes, timestamp, validate_sources

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("")
def read_notes(project_id: UUID | None = None, todo_id: UUID | None = None,
               limit: int = Query(20, ge=1, le=100), cursor: str | None = None,
               user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    items, next_cursor = list_notes(db, user.id, project_id, todo_id, limit, cursor)
    return list_envelope(items, next_cursor)


@router.get("/{note_id}")
def read_note(note_id: UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return data_envelope(project_notes(db, user.id, [owned_note(db, user.id, note_id)])[0])


async def write_note(request: Request, db: Session, user: User, raw_key: str | None,
                     note_id: UUID | None = None, payload: NoteCreate | NotePatch | None = None):
    if payload is None and await request.body():
        raise ApiError(400, "validation_error", "DELETE requires an empty body")
    key, fingerprint, replay = await get_idempotency_context(db, request=request, user_id=user.id, raw_key=raw_key)
    if replay is not None:
        return replay
    try:
        if note_id is None:
            changes = payload.model_dump()
            validate_sources(db, user.id, changes)
            now = datetime.now(timezone.utc)
            note = Note(user_id=user.id, created_at=now, updated_at=now, **changes)
            db.add(note)
        else:
            try:
                note = owned_note(db, user.id, note_id, lock=True)
            except ApiError:
                _, _, replay = await get_idempotency_context(db, request=request, user_id=user.id, raw_key=raw_key)
                if replay is not None:
                    return replay
                raise
            _, _, replay = await get_idempotency_context(db, request=request, user_id=user.id, raw_key=raw_key)
            if replay is not None:
                return replay
            changes = {} if payload is None else {
                field: value for field, value in payload.model_dump(exclude_unset=True).items()
                if getattr(note, field) != value
            }
            validate_sources(db, user.id, changes)
            if changes or payload is None:
                note.updated_at = datetime.now(timezone.utc)
                note.version += 1
                for field, value in changes.items():
                    setattr(note, field, value)
                if payload is None:
                    note.deleted_at = note.updated_at

        db.flush()
        status = 201 if note_id is None else 200
        data = project_notes(db, user.id, [note])[0] if payload is not None else {
            "id": str(note.id), "deleted": True, "deleted_at": timestamp(note.deleted_at), "version": note.version,
        }
        body = data_envelope(data)
        store_idempotency_response(db, user_id=user.id, key=key, method=request.method, path=request.url.path,
                                   request_hash=fingerprint, response_status=status, response_body=body)
        db.commit()
    except IntegrityError:
        db.rollback()
        # A simultaneous create with the same key may have committed first.
        _, _, replay = await get_idempotency_context(db, request=request, user_id=user.id, raw_key=raw_key)
        if replay is not None:
            return replay
        raise
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=status, content=body)


@router.post("")
async def create_note(payload: NoteCreate, request: Request, user: User = Depends(get_current_user),
                      db: Session = Depends(get_db), key: str | None = Header(None, alias="Idempotency-Key")):
    return await write_note(request, db, user, key, payload=payload)


@router.patch("/{note_id}")
async def patch_note(note_id: UUID, payload: NotePatch, request: Request, user: User = Depends(get_current_user),
                     db: Session = Depends(get_db), key: str | None = Header(None, alias="Idempotency-Key")):
    return await write_note(request, db, user, key, note_id, payload)


@router.delete("/{note_id}")
async def delete_note(note_id: UUID, request: Request, user: User = Depends(get_current_user),
                      db: Session = Depends(get_db), key: str | None = Header(None, alias="Idempotency-Key")):
    return await write_note(request, db, user, key, note_id)
