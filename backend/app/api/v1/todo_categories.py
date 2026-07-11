from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import data_envelope, list_envelope
from app.core.errors import ApiError
from app.core.time import now_server
from app.models.todo_category import TodoCategory
from app.models.user import User
from app.schemas.todo_category import TodoCategoryCreate, TodoCategoryRead, TodoCategoryUpdate
from app.services.idempotency import (
    get_idempotency_context,
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


def ensure_unique_active_name(
    db: Session,
    user_id: UUID,
    name: str,
    exclude_category_id: UUID | None = None,
) -> None:
    conditions = [
        TodoCategory.user_id == user_id,
        TodoCategory.deleted_at.is_(None),
        TodoCategory.name == name,
    ]
    if exclude_category_id is not None:
        conditions.append(TodoCategory.id != exclude_category_id)

    existing = db.execute(
        select(TodoCategory.id).where(*conditions)
    ).first()
    if existing is not None:
        raise ApiError(400, "validation_error", "category name already exists")


def get_current_user_category(db: Session, user_id: UUID, category_id: UUID) -> TodoCategory:
    category = db.execute(
        select(TodoCategory).where(
            TodoCategory.id == category_id,
            TodoCategory.user_id == user_id,
        )
    ).scalar_one_or_none()
    if category is None:
        raise ApiError(404, "not_found", "category not found")
    return category


def ensure_category_active(category: TodoCategory) -> None:
    if category.deleted_at is not None:
        raise ApiError(410, "deleted_resource", "category is deleted")


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
    key, request_hash, replay = await get_idempotency_context(
        db, request=request, user_id=current_user.id, raw_key=idempotency_key
    )
    if replay is not None:
        return replay

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
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(400, "validation_error", "category name already exists") from exc
    except Exception:
        db.rollback()
        raise

    return JSONResponse(status_code=201, content=response_body)


@router.patch("/{category_id}")
async def update_category(
    category_id: UUID,
    payload: TodoCategoryUpdate,
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
        category = get_current_user_category(db, current_user.id, category_id)
        ensure_category_active(category)

        changes = payload.model_dump(exclude_unset=True)
        if "name" in changes:
            name = changes["name"].strip()
            if name == "":
                raise ApiError(400, "validation_error", "name is required")
            ensure_unique_active_name(db, current_user.id, name, exclude_category_id=category.id)
            category.name = name
        if "color" in changes:
            category.color = changes["color"]
        if "icon" in changes:
            category.icon = changes["icon"]
        if "sort_order" in changes:
            category.sort_order = changes["sort_order"]

        category.updated_at = now_server()
        db.flush()

        category_data = category_to_dict(category)
        sync_change = create_sync_change(
            db,
            user_id=current_user.id,
            change_type="category.updated",
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
            response_status=200,
            response_body=response_body,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ApiError(400, "validation_error", "category name already exists") from exc
    except Exception:
        db.rollback()
        raise

    return JSONResponse(status_code=200, content=response_body)


@router.delete("/{category_id}")
async def delete_category(
    category_id: UUID,
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
        category = get_current_user_category(db, current_user.id, category_id)
        ensure_category_active(category)
        if category.is_inbox:
            raise ApiError(400, "invalid_state_transition", "Inbox category cannot be deleted")

        deleted_at = now_server()
        category.deleted_at = deleted_at
        category.updated_at = deleted_at
        db.flush()

        response_data = {"id": str(category.id), "deleted": True, "deleted_at": deleted_at.isoformat(timespec="seconds")}
        sync_change = create_sync_change(
            db,
            user_id=current_user.id,
            change_type="category.deleted",
            entity_type="todo_category",
            entity_id=category.id,
            payload={
                "deleted": True,
                "deleted_at": response_data["deleted_at"],
            },
        )
        response_body = data_envelope(response_data, sync={"cursor": sync_change.cursor})
        store_idempotency_response(
            db,
            user_id=current_user.id,
            key=key,
            method=request.method,
            path=request.url.path,
            request_hash=request_hash,
            response_status=200,
            response_body=response_body,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return JSONResponse(status_code=200, content=response_body)
