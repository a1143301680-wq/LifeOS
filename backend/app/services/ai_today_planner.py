from datetime import date
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import ApiError
from app.models.todo import Todo
from app.models.todo_category import TodoCategory
from app.models.user import User
from app.schemas.ai_today_plan import AIProviderPlan, AITodayPlanRead, AIUsage
from app.services.ai_today_provider import (
    AITodayProvider,
    CONTEXT_TOOL_NAME,
    ProviderFailure,
)
from app.services.todo_list import todo_list_order_by
from app.services.todo_today import classify_today_todos


def build_today_planning_context(
    db: Session,
    *,
    user: User,
    selected_date: date,
    todo_limit: int,
) -> dict:
    pending_todos = db.execute(
        select(Todo)
        .where(
            Todo.user_id == user.id,
            Todo.status == "pending",
            Todo.deleted_at.is_(None),
        )
        .order_by(*todo_list_order_by())
    ).scalars().all()
    categories = db.execute(
        select(TodoCategory)
        .where(
            TodoCategory.user_id == user.id,
            TodoCategory.deleted_at.is_(None),
        )
        .order_by(TodoCategory.sort_order.asc(), TodoCategory.created_at.asc())
        .limit(50)
    ).scalars().all()
    categories_by_id = {category.id: category for category in categories}
    active_inbox = next((category for category in categories if category.is_inbox), None)
    sections = classify_today_todos(
        todos=pending_todos,
        selected_date=selected_date,
        user=user,
        active_inbox=active_inbox,
    )

    ordered: list[tuple[Todo, str | None]] = []
    seen: set[UUID] = set()
    for section_name in ("overdue", "due", "planned", "inbox_recent"):
        for todo in sections[section_name]:
            if todo.id not in seen:
                ordered.append((todo, section_name))
                seen.add(todo.id)
    for todo in pending_todos:
        if todo.id not in seen:
            ordered.append((todo, None))
            seen.add(todo.id)
        if len(ordered) >= todo_limit:
            break

    todo_context = []
    for todo, section_name in ordered[:todo_limit]:
        category = categories_by_id.get(todo.category_id)
        todo_context.append(
            {
                "id": str(todo.id),
                "title": todo.title,
                "priority": todo.priority,
                "planned_date": todo.planned_date.isoformat() if todo.planned_date else None,
                "due_at": todo.due_at.isoformat() if todo.due_at else None,
                "category_id": str(category.id) if category else None,
                "category_name": category.name if category else None,
                "today_section": section_name,
            }
        )
    return {
        "date": selected_date.isoformat(),
        "timezone": user.timezone,
        "todos": todo_context,
        "categories": [
            {"id": str(category.id), "name": category.name}
            for category in categories
        ],
    }


def generate_today_plan(
    db: Session,
    *,
    user: User,
    selected_date: date,
    provider: AITodayProvider,
    settings: Settings,
) -> AITodayPlanRead:
    try:
        tool_request = provider.request_context_tool(selected_date)
        if tool_request.name != CONTEXT_TOOL_NAME or tool_request.arguments != {}:
            raise ProviderFailure("invalid_response")
        context = build_today_planning_context(
            db,
            user=user,
            selected_date=selected_date,
            todo_limit=settings.ai_context_todo_limit,
        )
        result = provider.request_final_plan(selected_date, tool_request, context)
    except ProviderFailure as exc:
        raise_provider_error(exc)

    if result.model != settings.deepseek_model:
        raise invalid_response()
    try:
        plan = AIProviderPlan.model_validate(result.payload)
    except ValidationError as exc:
        raise invalid_response() from exc

    supplied_todos = {UUID(item["id"]) for item in context["todos"]}
    supplied_categories = {UUID(item["id"]) for item in context["categories"]}
    references = [item.todo_id for item in plan.focus_items]
    references.extend(risk.todo_id for risk in plan.risks if risk.todo_id is not None)
    if any(reference not in supplied_todos for reference in references):
        raise invalid_response()
    if (
        plan.suggested_todo is not None
        and plan.suggested_todo.category_id is not None
        and plan.suggested_todo.category_id not in supplied_categories
    ):
        raise invalid_response()

    input_tokens = sum_optional(tool_request.input_tokens, result.input_tokens)
    output_tokens = sum_optional(tool_request.output_tokens, result.output_tokens)
    total_tokens = (
        input_tokens + output_tokens
        if input_tokens is not None and output_tokens is not None
        else None
    )
    return AITodayPlanRead(
        date=selected_date,
        **plan.model_dump(),
        usage=AIUsage(
            model=result.model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        ),
    )


def sum_optional(left: int | None, right: int | None) -> int | None:
    if left is None or right is None:
        return None
    return left + right


def invalid_response() -> ApiError:
    return ApiError(502, "ai_invalid_response", "AI planning returned an invalid response")


def raise_provider_error(exc: ProviderFailure) -> None:
    if exc.kind == "rate_limit":
        raise ApiError(429, "ai_rate_limited", "AI planning is temporarily rate limited")
    if exc.kind == "timeout":
        raise ApiError(504, "ai_timeout", "AI planning timed out")
    if exc.kind == "invalid_response":
        raise invalid_response()
    raise ApiError(503, "ai_provider_unavailable", "AI planning is temporarily unavailable")
