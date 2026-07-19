import base64
import json
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import and_, case, false, or_

from app.core.errors import ApiError
from app.models.todo import Todo

PRIORITY_RANK = {"high": 1, "medium": 2, "low": 3}
CURSOR_VERSION = 1
SORT_VERSION = "todo-list-v1"


def ensure_timezone_aware(value: datetime | None, field_name: str) -> None:
    if value is not None and (value.tzinfo is None or value.utcoffset() is None):
        raise ApiError(400, "validation_error", f"{field_name} must include timezone")


def priority_rank_expr():
    return case(
        (Todo.priority == "high", 1),
        (Todo.priority == "medium", 2),
        (Todo.priority == "low", 3),
        else_=4,
    )


def planned_null_expr():
    return case((Todo.planned_date.is_(None), 1), else_=0)


def due_null_expr():
    return case((Todo.due_at.is_(None), 1), else_=0)


def todo_list_order_by() -> list:
    return [
        planned_null_expr().asc(),
        Todo.planned_date.asc(),
        due_null_expr().asc(),
        Todo.due_at.asc(),
        priority_rank_expr().asc(),
        Todo.updated_at.desc(),
        Todo.id.asc(),
    ]


def normalize_todo_list_filters(
    *,
    status: str,
    category_id: UUID | None,
    planned_date: date | None,
    due_from: datetime | None,
    due_to: datetime | None,
) -> dict:
    if status not in {"pending", "completed", "all"}:
        raise ApiError(400, "validation_error", "status must be pending, completed, or all")
    ensure_timezone_aware(due_from, "due_from")
    ensure_timezone_aware(due_to, "due_to")
    if due_from is not None and due_to is not None and due_from > due_to:
        raise ApiError(400, "validation_error", "due_from must be before or equal to due_to")
    return {
        "status": status,
        "category_id": str(category_id) if category_id is not None else None,
        "planned_date": planned_date.isoformat() if planned_date is not None else None,
        "due_from": due_from.isoformat() if due_from is not None else None,
        "due_to": due_to.isoformat() if due_to is not None else None,
        "sort": SORT_VERSION,
    }


def todo_list_anchor(todo: Todo) -> dict:
    planned_date_is_null = todo.planned_date is None
    due_at_is_null = todo.due_at is None
    return {
        "planned_date_is_null": planned_date_is_null,
        "planned_date": None if planned_date_is_null else todo.planned_date.isoformat(),
        "due_at_is_null": due_at_is_null,
        "due_at": None if due_at_is_null else todo.due_at.isoformat(),
        "priority_rank": PRIORITY_RANK[todo.priority],
        "updated_at": todo.updated_at.isoformat(),
        "id": str(todo.id),
    }


def encode_todo_list_cursor(*, filters: dict, anchor: dict) -> str:
    payload = {"v": CURSOR_VERSION, "filters": filters, "anchor": anchor}
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_todo_list_cursor(raw_cursor: str | None, *, filters: dict) -> dict | None:
    if raw_cursor is None:
        return None
    try:
        padded = raw_cursor + "=" * (-len(raw_cursor) % 4)
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise ApiError(400, "validation_error", "cursor is invalid") from exc

    if not isinstance(payload, dict) or set(payload.keys()) != {"v", "filters", "anchor"}:
        raise ApiError(400, "validation_error", "cursor is invalid")
    if payload["v"] != CURSOR_VERSION:
        raise ApiError(400, "validation_error", "cursor version is unsupported")
    if payload["filters"] != filters:
        raise ApiError(400, "validation_error", "cursor does not match current filters")
    return validate_todo_list_anchor(payload["anchor"])


def validate_todo_list_anchor(anchor: object) -> dict:
    expected_keys = {
        "planned_date_is_null",
        "planned_date",
        "due_at_is_null",
        "due_at",
        "priority_rank",
        "updated_at",
        "id",
    }
    if not isinstance(anchor, dict) or set(anchor.keys()) != expected_keys:
        raise ApiError(400, "validation_error", "cursor anchor is invalid")

    planned_date_is_null = anchor["planned_date_is_null"]
    due_at_is_null = anchor["due_at_is_null"]
    priority_rank = anchor["priority_rank"]
    if not isinstance(planned_date_is_null, bool) or not isinstance(due_at_is_null, bool):
        raise ApiError(400, "validation_error", "cursor anchor is invalid")
    if priority_rank not in {1, 2, 3}:
        raise ApiError(400, "validation_error", "cursor anchor is invalid")

    planned_value = _parse_anchor_date(anchor["planned_date"], planned_date_is_null)
    due_value = _parse_anchor_datetime(anchor["due_at"], due_at_is_null)
    updated_at = _parse_required_anchor_datetime(anchor["updated_at"])
    try:
        todo_id = UUID(anchor["id"])
    except (TypeError, ValueError) as exc:
        raise ApiError(400, "validation_error", "cursor anchor is invalid") from exc

    return {
        "planned_date_is_null": planned_date_is_null,
        "planned_date": planned_value,
        "due_at_is_null": due_at_is_null,
        "due_at": due_value,
        "priority_rank": priority_rank,
        "updated_at": updated_at,
        "id": todo_id,
    }


def _parse_anchor_date(value: object, is_null: bool) -> date | None:
    if is_null:
        if value is not None:
            raise ApiError(400, "validation_error", "cursor anchor is invalid")
        return None
    if not isinstance(value, str):
        raise ApiError(400, "validation_error", "cursor anchor is invalid")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ApiError(400, "validation_error", "cursor anchor is invalid") from exc


def _parse_anchor_datetime(value: object, is_null: bool) -> datetime | None:
    if is_null:
        if value is not None:
            raise ApiError(400, "validation_error", "cursor anchor is invalid")
        return None
    return _parse_required_anchor_datetime(value)


def _parse_required_anchor_datetime(value: object) -> datetime:
    if not isinstance(value, str):
        raise ApiError(400, "validation_error", "cursor anchor is invalid")
    try:
        return datetime.fromisoformat(value)
    except ValueError as exc:
        raise ApiError(400, "validation_error", "cursor anchor is invalid") from exc


def todo_after_anchor_filter(anchor: dict):
    planned_null = planned_null_expr()
    due_null = due_null_expr()
    priority_rank = priority_rank_expr()
    sort_parts = [
        (
            planned_null == int(anchor["planned_date_is_null"]),
            planned_null > int(anchor["planned_date_is_null"]),
        ),
        (
            Todo.planned_date.is_(None)
            if anchor["planned_date_is_null"]
            else Todo.planned_date == anchor["planned_date"],
            false() if anchor["planned_date_is_null"] else Todo.planned_date > anchor["planned_date"],
        ),
        (
            due_null == int(anchor["due_at_is_null"]),
            due_null > int(anchor["due_at_is_null"]),
        ),
        (
            Todo.due_at.is_(None)
            if anchor["due_at_is_null"]
            else Todo.due_at == anchor["due_at"],
            false() if anchor["due_at_is_null"] else Todo.due_at > anchor["due_at"],
        ),
        (
            priority_rank == anchor["priority_rank"],
            priority_rank > anchor["priority_rank"],
        ),
        (
            Todo.updated_at == anchor["updated_at"],
            Todo.updated_at < anchor["updated_at"],
        ),
        (
            Todo.id == anchor["id"],
            Todo.id > anchor["id"],
        ),
    ]

    clauses = []
    equalities = []
    for equality, after in sort_parts:
        clauses.append(and_(*equalities, after) if equalities else after)
        equalities.append(equality)
    return or_(*clauses)
