from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import data_envelope, list_envelope
from app.core.errors import ApiError
from app.core.time import now_server
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.idempotency import get_idempotency_context, store_idempotency_response

router = APIRouter(prefix="/projects", tags=["projects"])


def project_to_dict(project: Project) -> dict:
    return ProjectRead.model_validate(project).model_dump(mode="json")


def get_owned_project(db: Session, user_id: UUID, project_id: UUID) -> Project:
    project = db.execute(select(Project).where(Project.id == project_id, Project.user_id == user_id)).scalar_one_or_none()
    if project is None:
        raise ApiError(404, "not_found", "project not found")
    return project


@router.get("")
def list_projects(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.execute(
        select(Project).where(Project.user_id == current_user.id)
        .order_by(Project.is_pinned.desc(), Project.updated_at.desc(), Project.id.asc())
    ).scalars()
    return list_envelope([project_to_dict(project) for project in projects])


@router.post("")
async def create_project(
    payload: ProjectCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    key, request_hash, replay = await get_idempotency_context(
        db, request=request, user_id=current_user.id, raw_key=idempotency_key
    )
    if replay is not None:
        return replay

    try:
        project = Project(user_id=current_user.id, **payload.model_dump())
        db.add(project)
        db.flush()
        body = data_envelope(project_to_dict(project))
        store_idempotency_response(
            db, user_id=current_user.id, key=key, method=request.method, path=request.url.path,
            request_hash=request_hash, response_status=201, response_body=body,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=201, content=body)


@router.get("/{project_id}")
def get_project(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return data_envelope(project_to_dict(get_owned_project(db, current_user.id, project_id)))


@router.patch("/{project_id}")
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    key, request_hash, replay = await get_idempotency_context(
        db, request=request, user_id=current_user.id, raw_key=idempotency_key
    )
    if replay is not None:
        return replay
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise ApiError(400, "validation_error", "at least one project field is required")

    try:
        project = get_owned_project(db, current_user.id, project_id)
        effective = {name: value for name, value in changes.items() if getattr(project, name) != value}
        if effective:
            for name, value in effective.items():
                setattr(project, name, value)
            project.version += 1
            project.updated_at = now_server()
            db.flush()
        body = data_envelope(project_to_dict(project))
        store_idempotency_response(
            db, user_id=current_user.id, key=key, method=request.method, path=request.url.path,
            request_hash=request_hash, response_status=200, response_body=body,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=200, content=body)
