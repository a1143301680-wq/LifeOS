from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models.sync import SyncChange


def get_latest_cursor(db: Session) -> int:
    return db.execute(select(func.coalesce(func.max(SyncChange.cursor), 0))).scalar_one()


def allocate_sync_cursor(db: Session) -> int:
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        return db.execute(text("select nextval('sync_changes_cursor_seq')")).scalar_one()

    pending_cursor = max(
        (
            change.cursor
            for change in db.new
            if isinstance(change, SyncChange) and change.cursor is not None
        ),
        default=0,
    )
    return max(get_latest_cursor(db), pending_cursor) + 1


def create_sync_change(
    db: Session,
    *,
    user_id: UUID,
    change_type: str,
    entity_type: str,
    entity_id: UUID | None = None,
    entity_version: int | None = None,
    payload: dict | None = None,
) -> SyncChange:
    change = SyncChange(
        user_id=user_id,
        cursor=allocate_sync_cursor(db),
        change_type=change_type,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_version=entity_version,
        payload=payload,
    )
    db.add(change)
    return change
