from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import data_envelope, list_envelope
from app.core.errors import ApiError
from app.models.todo_category import TodoCategory
from app.models.user import User
from app.schemas.todo_category import TodoCategoryCreate, TodoCategoryRead
from app.services.idempotency import (
    canonical_query,
    find_idempotency_record,
    request_fingerprint,
    require_idempotency_key,
    store_idempotency_response,
)
from app.services.sync import create_sync_change

router = APIRouter(prefix="/todo-categories", tags=["todo-categories"])


def category_to_dict(category: TodoCategory) -> dict:
    return TodoCategoryRead.model_validate(category).model_dump(mode="json")


def next_sort_order(db: Session, user_id: UUID) -> int:
    current_max = db.execute(
        select(func.coalesce(func.max(TodoCategory.sort_order), -1)).where(
            TodoCategory.user_id == user_id,
            TodoCategory.deleted_at.is_(None),
        )
    ).scalar_one()
    return current_max + 1


def ensure_unique_active_name(db: Session, user_id: UUID, name: str) -> None:
    existing = db.execute(
        select(TodoCategory.id).where(
            TodoCategory.user_id == user_id,
            TodoCategory.deleted_at.is_(None),
            TodoCategory.name == name,
        )
    ).first()
    if existing is not None:
        raise ApiError(400, "validation_error", "category name already exists")


@router.get("")
def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    categories = db.execute(
        select(TodoCategory)
        .where(
            TodoCategory.user_id == current_user.id,
            TodoCategory.deleted_at.is_(None),
        )
        .order_by(TodoCategory.sort_order.asc(), TodoCategory.created_at.asc())
    ).scalars()

    return list_envelope([category_to_dict(category) for category in categories])


@router.post("")
async def create_category(
    payload: TodoCategoryCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    key = require_idempotency_key(idempotency_key)
    body = await request.body()
    request_hash = request_fingerprint(
        request.method,
        request.url.path,
        canonical_query(request),
        body,
    )

    existing = find_idempotency_record(
        db,
        user_id=current_user.id,
        key=key,
        request_hash=request_hash,
    )
    if existing is not None:
        return JSONResponse(status_code=existing.response_status, content=existing.response_body)

    name = payload.name.strip()
    if name == "":
        raise ApiError(400, "validation_error", "name is required")

    try:
        ensure_unique_active_name(db, current_user.id, name)
        category = TodoCategory(
            user_id=current_user.id,
            name=name,
            color=payload.color,
            icon=payload.icon,
            is_inbox=False,
            sort_order=payload.sort_order
            if payload.sort_order is not None
            else next_sort_order(db, current_user.id),
        )
        db.add(category)
        db.flush()

        category_data = category_to_dict(category)
        sync_change = create_sync_change(
            db,
            user_id=current_user.id,
            change_type="category.created",
            entity_type="todo_category",
            entity_id=category.id,
            payload={"snapshot": category_data},
        )
        response_body = data_envelope(category_data, sync={"cursor": sync_change.cursor})
        store_idempotency_response(
            db,
            user_id=current_user.id,
            key=key,
            method=request.method,
            path=request.url.path,
            request_hash=request_hash,
            response_status=201,
            response_body=response_body,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return JSONResponse(status_code=201, content=response_body)
