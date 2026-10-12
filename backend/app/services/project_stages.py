from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.time import now_server
from app.models.project import Project
from app.models.project_stage import ProjectStage
from app.schemas.project_stage import StageCollectionPut


DEFAULT_STAGE_NAMES = {
    "development": ("Requirements", "UI design", "Development", "Testing", "Release"),
    "learning": ("Planning", "Study", "Practice", "Review"),
    "life": ("Planning", "Preparation", "Action", "Review"),
    "health": ("Baseline", "Plan", "Action", "Review"),
    "pet": ("Assessment", "Care plan", "Care", "Review"),
    "other": ("Planning", "Action", "Review"),
}


def seed_project_stages(db: Session, project: Project) -> None:
    db.add_all([
        ProjectStage(id=uuid4(), user_id=project.user_id, project_id=project.id, name=name, sort_order=position)
        for position, name in enumerate(DEFAULT_STAGE_NAMES[project.type])
    ])


def get_owned_project(db: Session, user_id: UUID, project_id: UUID, *, lock: bool = False) -> Project:
    query = select(Project).where(Project.id == project_id, Project.user_id == user_id)
    if lock:
        query = query.with_for_update()
    project = db.execute(query).scalar_one_or_none()
    if project is None:
        raise ApiError(404, "not_found", "project not found")
    return project


def stage_rows(db: Session, project_id: UUID) -> list[ProjectStage]:
    return list(db.execute(
        select(ProjectStage).where(ProjectStage.project_id == project_id)
        .order_by(ProjectStage.sort_order, ProjectStage.id)
    ).scalars())


def collection_data(project: Project, rows: list[ProjectStage]) -> dict:
    return {
        "stages": [{"id": str(row.id), "name": row.name, "sort_order": row.sort_order} for row in rows],
        "current_stage_id": next((str(row.id) for row in rows if row.is_current), None),
        "project_version": project.version,
    }


def replace_project_stages(db: Session, project: Project, payload: StageCollectionPut) -> dict:
    existing = stage_rows(db, project.id)
    requested = payload.stages
    requested_ids = [stage.id for stage in requested]
    if len(set(requested_ids)) != len(requested_ids):
        raise ApiError(400, "validation_error", "stage IDs must be unique")
    if payload.current_stage_id is not None and payload.current_stage_id not in requested_ids:
        raise ApiError(400, "validation_error", "current stage must be in stages")

    current_ids = {row.id for row in existing}
    added_ids = set(requested_ids) - current_ids
    if added_ids and db.execute(select(ProjectStage.id).where(ProjectStage.id.in_(added_ids))).first():
        raise ApiError(400, "validation_error", "stage ID is already in use")

    old_state = [(row.id, row.name, row.is_current) for row in existing]
    new_state = [(stage.id, stage.name, stage.id == payload.current_stage_id) for stage in requested]
    if old_state == new_state:
        return collection_data(project, existing)

    # Clear the old current row before selecting a new one so the partial index is never transiently violated.
    for row in existing:
        if row.is_current:
            row.is_current = False
    db.flush()

    retained = {row.id: row for row in existing}
    for row in existing:
        if row.id not in requested_ids:
            db.delete(row)
    db.flush()

    timestamp = now_server()
    for position, stage in enumerate(requested):
        row = retained.get(stage.id)
        if row is None:
            row = ProjectStage(
                id=stage.id, user_id=project.user_id, project_id=project.id,
                name=stage.name, sort_order=position, is_current=stage.id == payload.current_stage_id,
            )
            db.add(row)
        else:
            if row.name != stage.name or row.sort_order != position or row.is_current != (stage.id == payload.current_stage_id):
                row.name = stage.name
                row.sort_order = position
                row.is_current = stage.id == payload.current_stage_id
                row.updated_at = timestamp
    project.version += 1
    project.updated_at = timestamp
    db.flush()
    return collection_data(project, stage_rows(db, project.id))
