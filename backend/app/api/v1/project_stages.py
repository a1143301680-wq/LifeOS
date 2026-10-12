from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import data_envelope
from app.models.user import User
from app.schemas.project_stage import StageCollectionPut
from app.services.idempotency import get_idempotency_context, store_idempotency_response
from app.services.project_stages import collection_data, get_owned_project, replace_project_stages, stage_rows

router = APIRouter(prefix="/projects/{project_id}/stages", tags=["project-stages"])


@router.get("")
def get_stages(project_id: UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = get_owned_project(db, current_user.id, project_id)
    return data_envelope(collection_data(project, stage_rows(db, project.id)))


@router.put("")
async def put_stages(
    project_id: UUID,
    payload: StageCollectionPut,
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
        project = get_owned_project(db, current_user.id, project_id, lock=True)
        body = data_envelope(replace_project_stages(db, project, payload))
        store_idempotency_response(
            db, user_id=current_user.id, key=key, method=request.method, path=request.url.path,
            request_hash=request_hash, response_status=200, response_body=body,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return JSONResponse(status_code=200, content=body)
