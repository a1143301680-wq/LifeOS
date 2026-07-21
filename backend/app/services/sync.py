from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
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


def sync_change_to_dict(change: SyncChange) -> dict:
    item = {
        "cursor": change.cursor,
        "change_type": change.change_type,
        "entity_type": change.entity_type,
        "entity_id": str(change.entity_id) if change.entity_id is not None else None,
        "entity_version": change.entity_version,
    }
    if change.payload:
        item.update(change.payload)
    return item


def pull_sync_changes(
    db: Session,
    *,
    user_id: UUID,
    cursor: int,
    limit: int,
) -> tuple[list[dict], int, bool]:
    high_water = get_latest_cursor(db)
    if cursor > high_water:
        raise ApiError(400, "validation_error", "cursor is beyond the latest sync cursor")

    rows = (
        db.execute(
            select(SyncChange)
            .where(
                SyncChange.user_id == user_id,
                SyncChange.cursor > cursor,
                SyncChange.cursor <= high_water,
            )
            .order_by(SyncChange.cursor.asc())
            .limit(limit + 1)
        )
        .scalars()
        .all()
    )
    page = rows[:limit]
    has_more = len(rows) > limit
    next_cursor = page[-1].cursor if has_more else high_water
    return [sync_change_to_dict(change) for change in page], next_cursor, has_more
