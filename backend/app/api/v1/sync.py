from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import list_envelope
from app.models.user import User
from app.services.sync import pull_sync_changes

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/changes")
def get_sync_changes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    cursor: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
):
    items, next_cursor, has_more = pull_sync_changes(
        db,
        user_id=current_user.id,
        cursor=cursor,
        limit=limit,
    )
    return list_envelope(
        items,
        next_cursor=next_cursor,
        extra={"has_more": has_more},
    )
