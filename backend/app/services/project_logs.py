from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.time import now_server
from app.models.project_log import ProjectLog
from app.schemas.project_log import ProjectLogRead


def get_owned_log(db: Session, user_id: UUID, project_id: UUID, log_id: UUID) -> ProjectLog:
    row = db.execute(select(ProjectLog).where(
        ProjectLog.id == log_id, ProjectLog.user_id == user_id, ProjectLog.project_id == project_id,
    )).scalar_one_or_none()
    if row is None:
        raise ApiError(404, "not_found", "Project log not found")
    if row.deleted_at is not None:
        raise ApiError(410, "deleted_resource", "Project log is deleted")
    return row


def log_data(row: ProjectLog) -> dict:
    return ProjectLogRead.model_validate(row).model_dump(mode="json")


def bump_parent(project) -> None:
    project.version += 1
    project.updated_at = now_server()
