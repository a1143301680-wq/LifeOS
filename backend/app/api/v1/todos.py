from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.envelope import data_envelope, list_envelope
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
from app.services.todo_list import (
    decode_todo_list_cursor,
    encode_todo_list_cursor,
    normalize_todo_list_filters,
    todo_after_anchor_filter,
    todo_list_anchor,
    todo_list_order_by,
)
from app.services.todo_today import classify_today_todos, completed_count_for_day

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


def todo_delete_tombstone(todo: Todo) -> dict:
    return {
        "id": str(todo.id),
        "deleted": True,
        "deleted_at": todo.deleted_at.isoformat() if todo.deleted_at is not None else None,
        "version": todo.version,
    }


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


def get_todo_categories_for_response(
    db: Session, user_id: UUID, todos: list[Todo]
) -> dict[UUID, TodoCategory]:
    category_ids = {todo.category_id for todo in todos if todo.category_id is not None}
    if not category_ids:
        return {}
    categories = db.execute(
        select(TodoCategory).where(
            TodoCategory.user_id == user_id,
            TodoCategory.id.in_(category_ids),
        )
    ).scalars()
    return {category.id: category for category in categories}


@router.get("")
def list_todos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: str = "pending",
    category_id: UUID | None = None,
    planned_date: date | None = None,
    due_from: datetime | None = None,
    due_to: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = None,
):
    filters = normalize_todo_list_filters(
        status=status,
        category_id=category_id,
        planned_date=planned_date,
        due_from=due_from,
        due_to=due_to,
    )
    anchor = decode_todo_list_cursor(cursor, filters=filters)

    stmt = select(Todo).where(
        Todo.user_id == current_user.id,
        Todo.deleted_at.is_(None),
    )
    if status == "all":
        stmt = stmt.where(Todo.status.in_(["pending", "completed", "canceled"]))
    else:
        stmt = stmt.where(Todo.status == status)
    if category_id is not None:
        stmt = stmt.where(Todo.category_id == category_id)
    if planned_date is not None:
        stmt = stmt.where(Todo.planned_date == planned_date)
    if due_from is not None or due_to is not None:
        stmt = stmt.where(Todo.due_at.is_not(None))
    if due_from is not None:
        stmt = stmt.where(Todo.due_at >= due_from)
    if due_to is not None:
        stmt = stmt.where(Todo.due_at <= due_to)
    if anchor is not None:
        stmt = stmt.where(todo_after_anchor_filter(anchor))

    todos = db.execute(stmt.order_by(*todo_list_order_by()).limit(limit + 1)).scalars().all()
    page = todos[:limit]
    categories = get_todo_categories_for_response(db, current_user.id, page)
    items = [todo_to_dict(todo, categories.get(todo.category_id)) for todo in page]
    next_cursor = (
        encode_todo_list_cursor(filters=filters, anchor=todo_list_anchor(page[-1]))
        if len(todos) > limit
        else None
    )
    return list_envelope(items, extra={"next_cursor": next_cursor})


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


@router.post("/{todo_id}/reopen")
async def reopen_todo(
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
        if todo.status != "completed":
            raise ApiError(
                400,
                "invalid_state_transition",
                "todo must be completed to reopen",
            )

        reopened_at = now_server()
        todo.status = "pending"
        todo.completed_at = None
        todo.updated_at = reopened_at
        todo.version += 1
        db.flush()

        category = get_todo_category_for_response(db, current_user.id, todo.category_id)
        todo_data = todo_to_dict(todo, category)
        sync_change = create_sync_change(
            db,
            user_id=current_user.id,
            change_type="todo.reopened",
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
        raise ApiError(400, "validation_error", "todo could not be reopened") from exc
    except Exception:
        db.rollback()
        raise

    return JSONResponse(status_code=200, content=response_body)


@router.delete("/{todo_id}")
async def delete_todo(
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

        deleted_at = now_server()
        todo.deleted_at = deleted_at
        todo.updated_at = deleted_at
        todo.version += 1
        db.flush()

        tombstone = todo_delete_tombstone(todo)
        sync_change = create_sync_change(
            db,
            user_id=current_user.id,
            change_type="todo.deleted",
            entity_type="todo",
            entity_id=todo.id,
            entity_version=todo.version,
            payload=tombstone,
        )
        response_body = data_envelope(tombstone, sync={"cursor": sync_change.cursor})
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
        raise ApiError(400, "validation_error", "todo could not be deleted") from exc
    except Exception:
        db.rollback()
        raise

    return JSONResponse(status_code=200, content=response_body)


@router.get("/today")
def get_today_todos(
    selected_date: date = Query(alias="date"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    todos = db.execute(
        select(Todo).where(
            Todo.user_id == current_user.id,
            Todo.deleted_at.is_(None),
        )
    ).scalars().all()
    pending_todos = [todo for todo in todos if todo.status == "pending"]
    active_inbox = db.execute(
        select(TodoCategory).where(
            TodoCategory.user_id == current_user.id,
            TodoCategory.deleted_at.is_(None),
            TodoCategory.is_inbox.is_(True),
        )
    ).scalars().first()
    sections = classify_today_todos(
        todos=pending_todos,
        selected_date=selected_date,
        user=current_user,
        active_inbox=active_inbox,
    )
    section_todos = [
        todo
        for section_name in ("overdue", "due", "planned", "inbox_recent")
        for todo in sections[section_name]
    ]
    categories = get_todo_categories_for_response(db, current_user.id, section_todos)
    section_data = {
        section_name: [
            todo_to_dict(todo, categories.get(todo.category_id))
            for todo in section_items
        ]
        for section_name, section_items in sections.items()
    }
    pending_count = sum(len(items) for items in section_data.values())
    response_body = {
        "date": selected_date.isoformat(),
        "timezone": current_user.timezone,
        "sections": section_data,
        "summary": {
            "pending_count": pending_count,
            "completed_count": completed_count_for_day(todos, selected_date, current_user),
            "overdue_count": len(section_data["overdue"]),
        },
    }
    return data_envelope(response_body)


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
