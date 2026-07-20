from datetime import date, datetime, time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from app.models.todo import Todo
from app.models.todo_category import TodoCategory
from app.models.user import User
from app.services.todo_list import PRIORITY_RANK


def local_day_bounds(selected_date: date, timezone_name: str) -> tuple[datetime, datetime]:
    user_timezone = ZoneInfo(timezone_name)
    start = datetime.combine(selected_date, time.min, tzinfo=user_timezone)
    next_start = datetime.combine(
        selected_date + timedelta(days=1),
        time.min,
        tzinfo=user_timezone,
    )
    return start, next_start


def todo_datetime_in_user_timezone(value: datetime, timezone_name: str) -> datetime:
    user_timezone = ZoneInfo(timezone_name)
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=user_timezone)
    return value.astimezone(user_timezone)


def section_sort_key(todo: Todo) -> tuple:
    return (
        PRIORITY_RANK[todo.priority],
        todo.due_at is None,
        todo.due_at or datetime.max,
        todo.planned_date is None,
        todo.planned_date or date.max,
        todo.created_at,
        str(todo.id),
    )


def select_inbox_recent(todos: list[Todo], inbox_id: UUID | None) -> list[Todo]:
    if inbox_id is None:
        return []
    eligible = [
        todo
        for todo in todos
        if todo.category_id == inbox_id and todo.planned_date is None and todo.due_at is None
    ]
    newest = sorted(eligible, key=lambda todo: (todo.created_at, str(todo.id)), reverse=True)[:5]
    return sorted(newest, key=section_sort_key)


def classify_today_todos(
    *,
    todos: list[Todo],
    selected_date: date,
    user: User,
    active_inbox: TodoCategory | None,
) -> dict[str, list[Todo]]:
    start, end = local_day_bounds(selected_date, user.timezone)
    remaining = list(todos)
    sections: dict[str, list[Todo]] = {
        "overdue": [],
        "due": [],
        "planned": [],
        "inbox_recent": [],
    }

    for todo in list(remaining):
        if (
            todo.due_at is not None
            and todo_datetime_in_user_timezone(todo.due_at, user.timezone) < start
        ):
            sections["overdue"].append(todo)
            remaining.remove(todo)

    for todo in list(remaining):
        if todo.due_at is None:
            continue
        due_at = todo_datetime_in_user_timezone(todo.due_at, user.timezone)
        if start <= due_at < end:
            sections["due"].append(todo)
            remaining.remove(todo)

    for todo in list(remaining):
        if todo.planned_date == selected_date:
            sections["planned"].append(todo)
            remaining.remove(todo)

    inbox_id = active_inbox.id if active_inbox is not None else None
    sections["inbox_recent"] = select_inbox_recent(remaining, inbox_id)
    sections["overdue"] = sorted(sections["overdue"], key=section_sort_key)
    sections["due"] = sorted(sections["due"], key=section_sort_key)
    sections["planned"] = sorted(sections["planned"], key=section_sort_key)
    return sections


def completed_count_for_day(todos: list[Todo], selected_date: date, user: User) -> int:
    start, end = local_day_bounds(selected_date, user.timezone)
    count = 0
    for todo in todos:
        if todo.status != "completed" or todo.completed_at is None:
            continue
        completed_at = todo_datetime_in_user_timezone(todo.completed_at, user.timezone)
        if start <= completed_at < end:
            count += 1
    return count
