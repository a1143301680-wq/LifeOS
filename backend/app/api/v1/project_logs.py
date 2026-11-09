from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import data_envelope
from app.core.errors import ApiError
from app.core.time import now_server
from app.models.project_log import ProjectLog
from app.models.user import User
from app.schemas.project_log import ProjectLogCreate, ProjectLogPatch
from app.schemas.ai_session import as_utc
from app.services.idempotency import get_idempotency_context, store_idempotency_response
from app.services.project_logs import bump_parent, get_owned_log, log_data
from app.services.project_stages import get_owned_project

router = APIRouter(prefix="/projects/{project_id}/logs", tags=["project-logs"])


async def mutate(db, request, user, project_id, key, *, payload=None, log_id=None):
    key, request_hash, replay = await get_idempotency_context(db, request=request, user_id=user.id, raw_key=key)
    if replay is not None:
        return replay
    try:
        project = get_owned_project(db, user.id, project_id, lock=True)
        status = 200
        if request.method == "POST":
            row = ProjectLog(user_id=user.id, project_id=project_id, **payload.model_dump())
            db.add(row)
            bump_parent(project)
            status = 201
        else:
            row = get_owned_log(db, user.id, project_id, log_id)
            if request.method == "PATCH":
                changes = payload.model_dump(exclude_unset=True)
                if any(getattr(row, name) != value for name, value in changes.items()):
                    for name, value in changes.items():
                        setattr(row, name, value)
                    row.version += 1
                    row.updated_at = as_utc(now_server())
                    bump_parent(project)
            else:
                row.deleted_at = row.updated_at = as_utc(now_server())
                row.version += 1
                bump_parent(project)
        db.flush()
        data = {"id": str(row.id), "deleted": True, "deleted_at": row.deleted_at.isoformat(), "version": row.version} if request.method == "DELETE" else log_data(row)
        body = data_envelope(data)
        store_idempotency_response(db, user_id=user.id, key=key, method=request.method, path=request.url.path,
                                   request_hash=request_hash, response_status=status, response_body=body)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=status, content=body)


@router.post("")
async def create_log(project_id: UUID, payload: ProjectLogCreate, request: Request,
                     current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
                     idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    return await mutate(db, request, current_user, project_id, idempotency_key, payload=payload)


@router.get("/{log_id}")
def read_log(project_id: UUID, log_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_owned_project(db, current_user.id, project_id)
    return data_envelope(log_data(get_owned_log(db, current_user.id, project_id, log_id)))


@router.patch("/{log_id}")
async def patch_log(project_id: UUID, log_id: UUID, payload: ProjectLogPatch, request: Request,
                    current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
                    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    return await mutate(db, request, current_user, project_id, idempotency_key, payload=payload, log_id=log_id)


@router.delete("/{log_id}")
async def delete_log(project_id: UUID, log_id: UUID, request: Request,
                     current_user: User = Depends(get_current_user), db: Session = Depends(get_db),
                     idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    if await request.body():
        raise ApiError(400, "validation_error", "DELETE requires an empty body")
    return await mutate(db, request, current_user, project_id, idempotency_key, log_id=log_id)
