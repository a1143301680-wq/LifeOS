from datetime import timezone
from typing import Literal
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
from app.services.project_stages import get_owned_project, seed_project_stages

router = APIRouter(prefix="/projects", tags=["projects"])


def project_to_dict(project: Project) -> dict:
    return ProjectRead.model_validate(project).model_dump(mode="json")


@router.get("")
def list_projects(scope: Literal["active", "archived"] = "active", current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    archived = Project.archived_at.is_not(None) if scope == "archived" else Project.archived_at.is_(None)
    projects = db.execute(
        select(Project).where(Project.user_id == current_user.id, Project.deleted_at.is_(None), archived)
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
        seed_project_stages(db, project)
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
        project = get_owned_project(db, current_user.id, project_id, lock=True)
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


async def change_lifecycle(action: Literal["archive", "restore", "delete"], project_id: UUID,
                           request: Request, user: User, db: Session, raw_key: str | None):
    if await request.body():
        raise ApiError(400, "validation_error", "Lifecycle actions require an empty body")
    key, request_hash, replay = await get_idempotency_context(db, request=request, user_id=user.id, raw_key=raw_key)
    if replay is not None:
        return replay
    try:
        try:
            project = get_owned_project(db, user.id, project_id, lock=True)
        except ApiError:
            # A concurrent delete may have committed the matching response while we waited.
            _, _, replay = await get_idempotency_context(db, request=request, user_id=user.id, raw_key=raw_key)
            if replay is not None:
                return replay
            raise
        _, _, replay = await get_idempotency_context(db, request=request, user_id=user.id, raw_key=raw_key)
        if replay is not None:
            return replay
        archived = project.archived_at is not None
        if action == "delete" and not archived:
            raise ApiError(409, "project_not_archived", "Archive the project before deleting it")
        if action == "delete" or archived != (action == "archive"):
            now = now_server()
            project.updated_at = now
            project.version += 1
            if action == "delete":
                project.deleted_at = now.astimezone(timezone.utc)
            else:
                project.archived_at = now.astimezone(timezone.utc) if action == "archive" else None
            db.flush()
            if action != "delete":
                db.refresh(project)
        data = project_to_dict(project) if action != "delete" else {
            "id": str(project.id), "deleted": True, "deleted_at": project.deleted_at.isoformat(), "version": project.version,
        }
        body = data_envelope(data)
        store_idempotency_response(
            db, user_id=user.id, key=key, method=request.method, path=request.url.path,
            request_hash=request_hash, response_status=200, response_body=body,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=200, content=body)


@router.post("/{project_id}/archive")
async def archive_project(project_id: UUID, request: Request, current_user: User = Depends(get_current_user),
                          db: Session = Depends(get_db), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    return await change_lifecycle("archive", project_id, request, current_user, db, idempotency_key)


@router.post("/{project_id}/restore")
async def restore_project(project_id: UUID, request: Request, current_user: User = Depends(get_current_user),
                          db: Session = Depends(get_db), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    return await change_lifecycle("restore", project_id, request, current_user, db, idempotency_key)


@router.delete("/{project_id}")
async def delete_project(project_id: UUID, request: Request, current_user: User = Depends(get_current_user),
                         db: Session = Depends(get_db), idempotency_key: str | None = Header(default=None, alias="Idempotency-Key")):
    return await change_lifecycle("delete", project_id, request, current_user, db, idempotency_key)
