from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.services.project_stages import get_owned_project
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import data_envelope, list_envelope
from app.core.errors import ApiError
from app.models.ai_session import AISession
from app.models.user import User
from app.schemas.ai_session import AISessionCreate, AISessionRead, AISessionUpdate, as_utc
from app.services.idempotency import get_idempotency_context, store_idempotency_response

router = APIRouter(prefix="/projects/{project_id}/ai-sessions", tags=["ai-sessions"])


def session_to_dict(ai_session: AISession) -> dict:
    return AISessionRead.model_validate(ai_session).model_dump(mode="json")


def get_owned_session(db: Session, user_id: UUID, project_id: UUID, session_id: UUID) -> AISession:
    result = db.execute(select(AISession).where(
        AISession.id == session_id, AISession.user_id == user_id, AISession.project_id == project_id
    )).scalar_one_or_none()
    if result is None:
        raise ApiError(404, "not_found", "AI session not found")
    return result


def field_changed(ai_session: AISession, name: str, value: object) -> bool:
    current = getattr(ai_session, name)
    if name in ("started_at", "ended_at") and current is not None and value is not None:
        return as_utc(current) != as_utc(value)
    return current != value


@router.get("")
def list_ai_sessions(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_owned_project(db, current_user.id, project_id)
    sessions = db.execute(select(AISession).where(
        AISession.user_id == current_user.id, AISession.project_id == project_id
    ).order_by(AISession.started_at.desc(), AISession.id.asc())).scalars()
    return list_envelope([session_to_dict(item) for item in sessions])


@router.post("")
async def create_ai_session(
    project_id: UUID, payload: AISessionCreate, request: Request,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    key, request_hash, replay = await get_idempotency_context(
        db, request=request, user_id=current_user.id, raw_key=idempotency_key
    )
    if replay is not None:
        return replay
    try:
        get_owned_project(db, current_user.id, project_id, lock=True)
        ai_session = AISession(user_id=current_user.id, project_id=project_id, **payload.model_dump())
        db.add(ai_session)
        db.flush()
        body = data_envelope(session_to_dict(ai_session))
        store_idempotency_response(
            db, user_id=current_user.id, key=key, method=request.method, path=request.url.path,
            request_hash=request_hash, response_status=201, response_body=body,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=201, content=body)


@router.get("/{session_id}")
def read_ai_session(
    project_id: UUID, session_id: UUID,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    get_owned_project(db, current_user.id, project_id)
    return data_envelope(session_to_dict(get_owned_session(db, current_user.id, project_id, session_id)))


@router.patch("/{session_id}")
async def update_ai_session(
    project_id: UUID, session_id: UUID, payload: AISessionUpdate, request: Request,
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    key, request_hash, replay = await get_idempotency_context(
        db, request=request, user_id=current_user.id, raw_key=idempotency_key
    )
    if replay is not None:
        return replay
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise ApiError(400, "validation_error", "at least one AI session field is required")

    try:
        get_owned_project(db, current_user.id, project_id, lock=True)
        ai_session = get_owned_session(db, current_user.id, project_id, session_id)
        started_at = as_utc(changes.get("started_at", ai_session.started_at))
        ended_at = changes.get("ended_at", ai_session.ended_at)
        if ended_at is not None and as_utc(ended_at) < started_at:
            raise ApiError(400, "validation_error", "ended_at must be at or after started_at")
        effective = {name: value for name, value in changes.items() if field_changed(ai_session, name, value)}
        if effective:
            for name, value in effective.items():
                setattr(ai_session, name, value)
            ai_session.version += 1
            ai_session.updated_at = datetime.now(timezone.utc)
            db.flush()
        body = data_envelope(session_to_dict(ai_session))
        store_idempotency_response(
            db, user_id=current_user.id, key=key, method=request.method, path=request.url.path,
            request_hash=request_hash, response_status=200, response_body=body,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=200, content=body)
