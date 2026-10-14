from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.time import now_server
from app.models.milestone import Milestone
from app.models.project import Project
from app.schemas.milestone import MilestoneCollectionPut, MilestoneRead


def active_milestones(db: Session, project_id: UUID) -> list[Milestone]:
    return list(db.execute(
        select(Milestone).where(Milestone.project_id == project_id, Milestone.deleted_at.is_(None))
        .order_by(Milestone.sort_order, Milestone.id)
    ).scalars())


def collection_data(project: Project, rows: list[Milestone]) -> dict:
    return {
        "milestones": [MilestoneRead.model_validate(row).model_dump(mode="json") for row in rows],
        "project_version": project.version,
    }


def replace_milestones(db: Session, project: Project, payload: MilestoneCollectionPut) -> dict:
    existing = active_milestones(db, project.id)
    ids = [row.id for row in payload.milestones]
    if len(ids) != len(set(ids)):
        raise ApiError(400, "validation_error", "milestone IDs must be unique")
    retained = {row.id: row for row in existing}
    added_ids = set(ids) - retained.keys()
    if added_ids and db.execute(select(Milestone.id).where(Milestone.id.in_(added_ids))).first():
        raise ApiError(400, "validation_error", "milestone ID is already in use")

    old_state = [(row.id, row.title, row.target_date, row.status, row.sort_order) for row in existing]
    new_state = [(row.id, row.title, row.target_date, row.status, position) for position, row in enumerate(payload.milestones)]
    if old_state == new_state:
        return collection_data(project, existing)

    timestamp = now_server()
    for row in existing:
        if row.id not in ids:
            row.deleted_at = timestamp
            row.updated_at = timestamp
            row.version += 1
    for position, item in enumerate(payload.milestones):
        row = retained.get(item.id)
        if row is None:
            db.add(Milestone(
                id=item.id, user_id=project.user_id, project_id=project.id,
                title=item.title, target_date=item.target_date, status=item.status, sort_order=position,
            ))
        elif (row.title, row.target_date, row.status, row.sort_order) != (item.title, item.target_date, item.status, position):
            row.title, row.target_date, row.status, row.sort_order = item.title, item.target_date, item.status, position
            row.version += 1
            row.updated_at = timestamp
    project.version += 1
    project.updated_at = timestamp
    db.flush()
    return collection_data(project, active_milestones(db, project.id))
