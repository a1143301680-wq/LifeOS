from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.todo_category import TodoCategory
from app.models.user import User


@dataclass(frozen=True)
class DefaultCategorySpec:
    name: str
    sort_order: int
    is_inbox: bool = False


DEFAULT_TODO_CATEGORIES: tuple[DefaultCategorySpec, ...] = (
    DefaultCategorySpec("Inbox", 0, True),
    DefaultCategorySpec("Work", 1),
    DefaultCategorySpec("Study", 2),
    DefaultCategorySpec("Life", 3),
    DefaultCategorySpec("Partner", 4),
    DefaultCategorySpec("Pet", 5),
    DefaultCategorySpec("Health", 6),
    DefaultCategorySpec("Interest", 7),
    DefaultCategorySpec("AI", 8),
    DefaultCategorySpec("Project", 9),
)


def normalize_active_inboxes(db: Session, user_id: UUID) -> TodoCategory | None:
    active_inboxes = (
        db.execute(
            select(TodoCategory)
            .where(
                TodoCategory.user_id == user_id,
                TodoCategory.is_inbox.is_(True),
                TodoCategory.deleted_at.is_(None),
            )
            .order_by(
                TodoCategory.sort_order.asc(),
                TodoCategory.created_at.asc(),
                TodoCategory.id.asc(),
            )
        )
        .scalars()
        .all()
    )
    if not active_inboxes:
        return None

    canonical_inbox = active_inboxes[0]
    for extra_inbox in active_inboxes[1:]:
        extra_inbox.is_inbox = False
    return canonical_inbox


def get_active_category_by_name(
    db: Session, user_id: UUID, name: str
) -> TodoCategory | None:
    return db.execute(
        select(TodoCategory).where(
            TodoCategory.user_id == user_id,
            TodoCategory.name == name,
            TodoCategory.deleted_at.is_(None),
        )
    ).scalar_one_or_none()


def seed_default_categories_for_user(db: Session, user: User) -> list[TodoCategory]:
    created: list[TodoCategory] = []
    inbox_exists = normalize_active_inboxes(db, user.id) is not None

    for spec in DEFAULT_TODO_CATEGORIES:
        if spec.is_inbox:
            if inbox_exists:
                continue
            active_inbox_by_name = get_active_category_by_name(db, user.id, spec.name)
            if active_inbox_by_name is not None:
                active_inbox_by_name.is_inbox = True
                inbox_exists = True
                continue
        elif get_active_category_by_name(db, user.id, spec.name) is not None:
            continue

        category = TodoCategory(
            user_id=user.id,
            name=spec.name,
            is_inbox=spec.is_inbox,
            sort_order=spec.sort_order,
        )
        db.add(category)
        created.append(category)
        if spec.is_inbox:
            inbox_exists = True

    return created


def seed_default_categories_for_all_users(db: Session) -> list[TodoCategory]:
    created: list[TodoCategory] = []
    users = db.execute(select(User).order_by(User.alias.asc())).scalars().all()
    for user in users:
        created.extend(seed_default_categories_for_user(db, user))
    return created
