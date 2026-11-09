from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import list_envelope
from app.models.user import User
from app.services.project_stages import get_owned_project
from app.services.project_timeline import timeline_page

router = APIRouter(prefix="/projects/{project_id}/timeline", tags=["project-timeline"])


@router.get("")
def read_timeline(project_id: UUID, limit: int = Query(default=20, ge=1, le=100), cursor: str | None = None,
                  current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_owned_project(db, current_user.id, project_id)
    items, next_cursor = timeline_page(db, current_user.id, project_id, limit, cursor)
    return list_envelope(items, extra={"next_cursor": next_cursor})
