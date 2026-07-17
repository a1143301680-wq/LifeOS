from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import data_envelope
from app.core.errors import ApiError
from app.core.time import now_server
from app.models.todo import Todo
from app.models.todo_category import TodoCategory
from app.models.user import User
from app.schemas.todo import TodoCategorySummary, TodoCreate, TodoRead, TodoUpdate
from app.services.idempotency import (
    get_idempotency_context,
    require_idempotency_key,
    store_idempotency_response,
)
from app.services.sync import create_sync_change

router = APIRouter(prefix="/todos", tags=["todos"])


def category_summary(category: TodoCategory | None) -> TodoCategorySummary | None:
    if category is None:
        return None
    return TodoCategorySummary(
        id=category.id,
        name=category.name,
        is_deleted=category.deleted_at is not None,
    )


def todo_to_dict(todo: Todo, category: TodoCategory | None) -> dict:
    return TodoRead(
        id=todo.id,
        category_id=todo.category_id,
        category=category_summary(category),
        title=todo.title,
        note=todo.note,
        status=todo.status,
        priority=todo.priority,
        planned_date=todo.planned_date,
        due_at=todo.due_at,
        completed_at=todo.completed_at,
        version=todo.version,
        created_at=todo.created_at,
        updated_at=todo.updated_at,
    ).model_dump(mode="json")


def get_owned_active_category(db: Session, user_id: UUID, category_id: UUID) -> TodoCategory:
    category = db.execute(
        select(TodoCategory).where(
            TodoCategory.id == category_id,
            TodoCategory.user_id == user_id,
        )
    ).scalar_one_or_none()
    if category is None:
        raise ApiError(404, "not_found", "category not found")
    if category.deleted_at is not None:
        raise ApiError(410, "deleted_resource", "category is deleted")
    return category


def resolve_active_inbox(db: Session, user_id: UUID) -> TodoCategory:
    inboxes = db.execute(
        select(TodoCategory).where(
            TodoCategory.user_id == user_id,
            TodoCategory.deleted_at.is_(None),
            TodoCategory.is_inbox.is_(True),
        )
    ).scalars().all()
    if len(inboxes) != 1:
        raise ApiError(400, "invalid_state_transition", "active Inbox invariant is invalid")
    return inboxes[0]


def ensure_todo_id_available(db: Session, todo_id: UUID) -> None:
    existing = db.execute(select(Todo.id).where(Todo.id == todo_id)).first()
    if existing is not None:
        raise ApiError(400, "validation_error", "todo id already exists")


def get_current_user_todo(db: Session, user_id: UUID, todo_id: UUID) -> Todo:
    todo = db.execute(
        select(Todo).where(
            Todo.id == todo_id,
            Todo.user_id == user_id,
        )
    ).scalar_one_or_none()
    if todo is None:
        raise ApiError(404, "not_found", "todo not found")
    return todo


def get_todo_category_for_response(
    db: Session, user_id: UUID, category_id: UUID | None
) -> TodoCategory | None:
    if category_id is None:
        return None
    return db.execute(
        select(TodoCategory).where(
            TodoCategory.id == category_id,
            TodoCategory.user_id == user_id,
        )
    ).scalar_one_or_none()


@router.post("")
async def create_todo(
    payload: TodoCreate,
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
        category = (
            get_owned_active_category(db, current_user.id, payload.category_id)
            if payload.category_id is not None
            else resolve_active_inbox(db, current_user.id)
        )

        if payload.id is not None:
            ensure_todo_id_available(db, payload.id)

        todo = Todo(
            id=payload.id,
            user_id=current_user.id,
            category_id=category.id,
            title=payload.title,
            note=payload.note,
            status="pending",
            priority=payload.priority,
            planned_date=payload.planned_date,
            due_at=payload.due_at,
            completed_at=None,
            canceled_at=None,
            generated_for_date=None,
            source_client_id=None,
            client_created_id=None,
            version=1,
            deleted_at=None,
        )
        db.add(todo)
        db.flush()

        todo_data = todo_to_dict(todo, category)
        sync_change = create_sync_change(
            db,
            user_id=current_user.id,
            change_type="todo.created",
            entity_type="todo",
            entity_id=todo.id,
            entity_version=todo.version,
            payload={"snapshot": todo_data},
        )
        response_body = data_envelope(todo_data, sync={"cursor": sync_change.cursor})
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
        raise ApiError(400, "validation_error", "todo could not be created") from exc
    except Exception:
        db.rollback()
        raise

    return JSONResponse(status_code=201, content=response_body)


@router.post("/{todo_id}/complete")
async def complete_todo(
    todo_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    require_idempotency_key(idempotency_key)
    if await request.body() != b"":
        raise ApiError(400, "validation_error", "request body is not allowed")

    key, request_hash, replay = await get_idempotency_context(
        db, request=request, user_id=current_user.id, raw_key=idempotency_key
    )
    if replay is not None:
        return replay

    try:
        todo = get_current_user_todo(db, current_user.id, todo_id)
        if todo.deleted_at is not None:
            raise ApiError(410, "deleted_resource", "todo is deleted")
        if todo.status != "pending":
            raise ApiError(
                400,
                "invalid_state_transition",
                "todo must be pending to complete",
            )

        completed_at = now_server()
        todo.status = "completed"
        todo.completed_at = completed_at
        todo.updated_at = completed_at
        todo.version += 1
        db.flush()

        category = get_todo_category_for_response(db, current_user.id, todo.category_id)
        todo_data = todo_to_dict(todo, category)
        sync_change = create_sync_change(
            db,
            user_id=current_user.id,
            change_type="todo.completed",
            entity_type="todo",
            entity_id=todo.id,
            entity_version=todo.version,
            payload={"snapshot": todo_data},
        )
        response_body = data_envelope(todo_data, sync={"cursor": sync_change.cursor})
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
        raise ApiError(400, "validation_error", "todo could not be completed") from exc
    except Exception:
        db.rollback()
        raise

    return JSONResponse(status_code=200, content=response_body)


@router.get("/{todo_id}")
def get_todo(
    todo_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    todo = get_current_user_todo(db, current_user.id, todo_id)
    if todo.deleted_at is not None:
        raise ApiError(410, "deleted_resource", "todo is deleted")

    category = get_todo_category_for_response(db, current_user.id, todo.category_id)

    return data_envelope(todo_to_dict(todo, category))


@router.patch("/{todo_id}")
async def update_todo(
    todo_id: UUID,
    payload: TodoUpdate,
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

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise ApiError(400, "validation_error", "update payload is required")

    try:
        todo = get_current_user_todo(db, current_user.id, todo_id)
        if todo.deleted_at is not None:
            raise ApiError(410, "deleted_resource", "todo is deleted")

        category_for_response = get_todo_category_for_response(
            db, current_user.id, todo.category_id
        )
        if "category_id" in changes:
            if changes["category_id"] is None:
                todo.category_id = None
                category_for_response = None
            else:
                category_for_response = get_owned_active_category(
                    db, current_user.id, changes["category_id"]
                )
                todo.category_id = category_for_response.id

        if "title" in changes:
            todo.title = changes["title"]
        if "note" in changes:
            todo.note = changes["note"]
        if "priority" in changes:
            todo.priority = changes["priority"]
        if "planned_date" in changes:
            todo.planned_date = changes["planned_date"]
        if "due_at" in changes:
            todo.due_at = changes["due_at"]

        todo.version += 1
        todo.updated_at = now_server()
        db.flush()

        todo_data = todo_to_dict(todo, category_for_response)
        sync_change = create_sync_change(
            db,
            user_id=current_user.id,
            change_type="todo.updated",
            entity_type="todo",
            entity_id=todo.id,
            entity_version=todo.version,
            payload={"snapshot": todo_data},
        )
        response_body = data_envelope(todo_data, sync={"cursor": sync_change.cursor})
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
        raise ApiError(400, "validation_error", "todo could not be updated") from exc
    except Exception:
        db.rollback()
        raise

    return JSONResponse(status_code=200, content=response_body)
