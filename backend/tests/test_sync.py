from uuid import uuid4

from argon2 import PasswordHasher
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.user import User
from app.services.sync import create_sync_change, get_latest_cursor


def test_create_sync_change_allocates_monotonic_cursor(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'lifeos-test.db'}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    user_id = uuid4()
    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)

    with TestingSessionLocal() as db:
        db.add(
            User(
                id=user_id,
                alias="me",
                display_name="Me",
                bootstrap_token_hash=hasher.hash("token"),
                timezone="Asia/Shanghai",
            )
        )
        first = create_sync_change(
            db,
            user_id=user_id,
            change_type="category.created",
            entity_type="todo_category",
            entity_id=uuid4(),
            entity_version=1,
            payload={"name": "Inbox"},
        )
        second = create_sync_change(
            db,
            user_id=user_id,
            change_type="category.updated",
            entity_type="todo_category",
            entity_id=uuid4(),
            entity_version=2,
            payload={"name": "Work"},
        )
        db.commit()

        assert first.cursor == 1
        assert second.cursor == 2
        assert get_latest_cursor(db) == 2
