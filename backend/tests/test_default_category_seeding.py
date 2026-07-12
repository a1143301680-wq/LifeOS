from datetime import datetime
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.todo_category import TodoCategory
from app.models.user import User
import app.scripts.bootstrap_users as bootstrap_users
from app.scripts.bootstrap_users import bootstrap_seed_data
from app.services.default_categories import DEFAULT_TODO_CATEGORIES, seed_default_categories_for_user


@pytest.fixture()
def session_factory(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'lifeos-test.db'}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    return TestingSessionLocal


def active_categories(db, user_id):
    return (
        db.execute(
            select(TodoCategory)
            .where(TodoCategory.user_id == user_id, TodoCategory.deleted_at.is_(None))
            .order_by(TodoCategory.sort_order.asc(), TodoCategory.created_at.asc())
        )
        .scalars()
        .all()
    )


def create_user(db, alias="me"):
    user = User(
        id=uuid4(),
        alias=alias,
        display_name=alias.title(),
        bootstrap_token_hash=PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1).hash(
            f"{alias}-token"
        ),
        timezone="Asia/Shanghai",
    )
    db.add(user)
    db.flush()
    return user


def test_bootstrap_new_users_get_default_categories(session_factory):
    with session_factory() as db:
        created_tokens = bootstrap_seed_data(db)

    assert created_tokens["me"] is not None
    assert created_tokens["partner"] is not None

    with session_factory() as db:
        users = db.execute(select(User).order_by(User.alias.asc())).scalars().all()
        assert [user.alias for user in users] == ["me", "partner"]

        for user in users:
            categories = active_categories(db, user.id)
            assert [category.name for category in categories] == [
                spec.name for spec in DEFAULT_TODO_CATEGORIES
            ]
            assert [category.sort_order for category in categories] == list(range(10))
            assert sum(category.is_inbox for category in categories) == 1
            assert categories[0].name == "Inbox"
            assert categories[0].is_inbox is True


def test_bootstrap_rerun_is_idempotent_and_does_not_return_existing_tokens(session_factory):
    with session_factory() as db:
        first_tokens = bootstrap_seed_data(db)
        second_tokens = bootstrap_seed_data(db)

        assert first_tokens["me"] is not None
        assert first_tokens["partner"] is not None
        assert second_tokens == {"me": None, "partner": None}
        assert len(db.execute(select(User)).scalars().all()) == 2

        for user in db.execute(select(User)).scalars():
            categories = active_categories(db, user.id)
            assert len(categories) == 10
            assert len({category.name for category in categories}) == 10
            assert sum(category.is_inbox for category in categories) == 1


def test_bootstrap_backfills_existing_user_missing_categories(session_factory):
    with session_factory() as db:
        user = create_user(db)
        db.add(
            TodoCategory(
                user_id=user.id,
                name="Inbox",
                is_inbox=True,
                sort_order=0,
            )
        )
        db.commit()

        created_tokens = bootstrap_seed_data(db)

        categories = active_categories(db, user.id)
        assert created_tokens["me"] is None
        assert created_tokens["partner"] is not None
        assert [category.name for category in categories] == [
            spec.name for spec in DEFAULT_TODO_CATEGORIES
        ]
        assert sum(category.is_inbox for category in categories) == 1


def test_existing_active_inbox_is_preserved_and_not_duplicated(session_factory):
    with session_factory() as db:
        user = create_user(db)
        inbox_id = uuid4()
        db.add(
            TodoCategory(
                id=inbox_id,
                user_id=user.id,
                name="Main Inbox",
                is_inbox=True,
                sort_order=42,
            )
        )
        db.commit()

        seed_default_categories_for_user(db, user)
        db.commit()

        categories = active_categories(db, user.id)
        inboxes = [category for category in categories if category.is_inbox]
        assert len(inboxes) == 1
        assert inboxes[0].id == inbox_id
        assert inboxes[0].name == "Main Inbox"
        assert not any(category.name == "Inbox" and category.id != inbox_id for category in categories)


def test_active_inbox_name_category_is_promoted_to_inbox_instead_of_duplicated(
    session_factory,
):
    with session_factory() as db:
        user = create_user(db)
        inbox_named_id = uuid4()
        db.add(
            TodoCategory(
                id=inbox_named_id,
                user_id=user.id,
                name="Inbox",
                is_inbox=False,
                sort_order=0,
            )
        )
        db.commit()

        seed_default_categories_for_user(db, user)
        db.commit()

        categories = active_categories(db, user.id)
        inbox_rows = [category for category in categories if category.name == "Inbox"]
        assert len(inbox_rows) == 1
        assert inbox_rows[0].id == inbox_named_id
        assert inbox_rows[0].is_inbox is True
        assert sum(category.is_inbox for category in categories) == 1


def test_multiple_active_inboxes_are_normalized_to_one_deterministic_inbox(
    session_factory,
):
    with session_factory() as db:
        user = create_user(db)
        keep_inbox_id = uuid4()
        demote_inbox_id = uuid4()
        db.add_all(
            [
                TodoCategory(
                    id=demote_inbox_id,
                    user_id=user.id,
                    name="Later Inbox",
                    is_inbox=True,
                    sort_order=20,
                ),
                TodoCategory(
                    id=keep_inbox_id,
                    user_id=user.id,
                    name="Primary Inbox",
                    is_inbox=True,
                    sort_order=10,
                ),
            ]
        )
        db.commit()

        seed_default_categories_for_user(db, user)
        db.commit()

        categories = active_categories(db, user.id)
        inboxes = [category for category in categories if category.is_inbox]
        demoted = next(category for category in categories if category.id == demote_inbox_id)
        assert len(inboxes) == 1
        assert inboxes[0].id == keep_inbox_id
        assert inboxes[0].name == "Primary Inbox"
        assert demoted.name == "Later Inbox"
        assert demoted.is_inbox is False


def test_soft_deleted_default_category_creates_new_active_row_and_preserves_tombstone(
    session_factory,
):
    deleted_at = datetime(2026, 7, 11)

    with session_factory() as db:
        user = create_user(db)
        deleted_work_id = uuid4()
        db.add_all(
            [
                TodoCategory(
                    user_id=user.id,
                    name="Inbox",
                    is_inbox=True,
                    sort_order=0,
                ),
                TodoCategory(
                    id=deleted_work_id,
                    user_id=user.id,
                    name="Work",
                    is_inbox=False,
                    sort_order=1,
                    deleted_at=deleted_at,
                ),
            ]
        )
        db.commit()

        seed_default_categories_for_user(db, user)
        db.commit()

        work_rows = (
            db.execute(
                select(TodoCategory).where(
                    TodoCategory.user_id == user.id,
                    TodoCategory.name == "Work",
                )
            )
            .scalars()
            .all()
        )
        assert len(work_rows) == 2
        assert sum(row.deleted_at is None for row in work_rows) == 1
        deleted_row = next(row for row in work_rows if row.id == deleted_work_id)
        assert deleted_row.deleted_at == deleted_at
        assert deleted_row.sort_order == 1


def test_soft_deleted_inbox_creates_new_active_inbox_and_preserves_tombstone(session_factory):
    deleted_at = datetime(2026, 7, 11)

    with session_factory() as db:
        user = create_user(db)
        deleted_inbox_id = uuid4()
        db.add(
            TodoCategory(
                id=deleted_inbox_id,
                user_id=user.id,
                name="Inbox",
                is_inbox=True,
                sort_order=0,
                deleted_at=deleted_at,
            )
        )
        db.commit()

        seed_default_categories_for_user(db, user)
        db.commit()

        inbox_rows = (
            db.execute(
                select(TodoCategory).where(
                    TodoCategory.user_id == user.id,
                    TodoCategory.name == "Inbox",
                )
            )
            .scalars()
            .all()
        )
        assert len(inbox_rows) == 2
        assert sum(row.deleted_at is None and row.is_inbox for row in inbox_rows) == 1
        deleted_row = next(row for row in inbox_rows if row.id == deleted_inbox_id)
        assert deleted_row.deleted_at == deleted_at
        assert deleted_row.is_inbox is True


def test_bootstrap_main_does_not_print_existing_raw_tokens(
    session_factory, monkeypatch, capsys
):
    monkeypatch.setattr(bootstrap_users, "SessionLocal", session_factory)

    bootstrap_users.main()
    first_output = capsys.readouterr().out
    bootstrap_users.main()
    second_output = capsys.readouterr().out

    assert "me: already exists; token was not rotated" in second_output
    assert "partner: already exists; token was not rotated" in second_output
    assert second_output.count("already exists; token was not rotated") == 2
    assert first_output != second_output
