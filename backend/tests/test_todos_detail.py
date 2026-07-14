from datetime import datetime
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import create_app
from app.models.idempotency import IdempotencyKey
from app.models.sync import SyncChange
from app.models.todo import Todo
from app.models.todo_category import TodoCategory
from app.models.user import User


def make_todo(*, user_id, category_id, title="Read me", deleted_at=None):
    return Todo(
        id=uuid4(),
        user_id=user_id,
        category_id=category_id,
        title=title,
        note=None,
        status="pending",
        priority="medium",
        version=1,
        deleted_at=deleted_at,
    )


def auth_headers(todo_detail_client, alias: str = "me"):
    return {"Authorization": f"Bearer {todo_detail_client.tokens[alias]}"}


def row_counts(todo_detail_client):
    with todo_detail_client.session_factory() as db:
        return {
            "todos": len(db.execute(select(Todo)).all()),
            "sync_changes": len(db.execute(select(SyncChange)).all()),
            "idempotency": len(db.execute(select(IdempotencyKey)).all()),
        }


def test_get_todo_returns_owned_active_todo_with_active_category(todo_detail_client):
    todo_id = todo_detail_client.todo_ids["active"]

    response = todo_detail_client.get(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_detail_client),
    )

    assert response.status_code == 200
    body = response.json()
    assert "sync" not in body
    assert body["data"]["id"] == str(todo_id)
    assert body["data"]["title"] == "Read me"
    assert body["data"]["status"] == "pending"
    assert body["data"]["version"] == 1
    assert body["data"]["category_id"] == str(todo_detail_client.category_ids["active"])
    assert body["data"]["category"] == {
        "id": str(todo_detail_client.category_ids["active"]),
        "name": "Work",
        "is_deleted": False,
    }
    assert "user_id" not in body["data"]
    assert "deleted_at" not in body["data"]
    assert "recurring_template_id" not in body["data"]
    assert "source_client_id" not in body["data"]
    assert "client_created_id" not in body["data"]

    assert row_counts(todo_detail_client) == {
        "todos": 6,
        "sync_changes": 0,
        "idempotency": 0,
    }


def test_get_todo_returns_deleted_category_summary_without_hiding_todo(todo_detail_client):
    todo_id = todo_detail_client.todo_ids["deleted_category"]

    response = todo_detail_client.get(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_detail_client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["category_id"] == str(todo_detail_client.category_ids["deleted"])
    assert body["data"]["category"] == {
        "id": str(todo_detail_client.category_ids["deleted"]),
        "name": "Archived",
        "is_deleted": True,
    }


def test_get_todo_returns_null_category_when_category_is_missing_or_null(todo_detail_client):
    missing_category = todo_detail_client.get(
        f"/api/v1/todos/{todo_detail_client.todo_ids['missing_category']}",
        headers=auth_headers(todo_detail_client),
    )
    null_category = todo_detail_client.get(
        f"/api/v1/todos/{todo_detail_client.todo_ids['null_category']}",
        headers=auth_headers(todo_detail_client),
    )

    assert missing_category.status_code == 200
    assert missing_category.json()["data"]["category"] is None
    assert null_category.status_code == 200
    assert null_category.json()["data"]["category_id"] is None
    assert null_category.json()["data"]["category"] is None


def test_get_todo_returns_same_404_for_missing_and_cross_user_todo(todo_detail_client):
    missing = todo_detail_client.get(
        f"/api/v1/todos/{uuid4()}",
        headers=auth_headers(todo_detail_client),
    )
    cross_user = todo_detail_client.get(
        f"/api/v1/todos/{todo_detail_client.todo_ids['partner']}",
        headers=auth_headers(todo_detail_client),
    )

    assert missing.status_code == 404
    assert cross_user.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"
    assert cross_user.json()["error"]["code"] == "not_found"
    assert missing.json()["error"]["message"] == cross_user.json()["error"]["message"]


def test_get_todo_returns_deleted_resource_for_current_user_soft_deleted_todo(todo_detail_client):
    response = todo_detail_client.get(
        f"/api/v1/todos/{todo_detail_client.todo_ids['deleted_todo']}",
        headers=auth_headers(todo_detail_client),
    )

    assert response.status_code == 410
    assert response.json()["error"]["code"] == "deleted_resource"


def test_get_todo_auth_and_invalid_uuid_follow_existing_conventions(todo_detail_client):
    missing_auth = todo_detail_client.get(
        f"/api/v1/todos/{todo_detail_client.todo_ids['active']}",
    )
    bad_token = todo_detail_client.get(
        f"/api/v1/todos/{todo_detail_client.todo_ids['active']}",
        headers={"Authorization": "Bearer wrong"},
    )
    invalid_uuid = todo_detail_client.get(
        "/api/v1/todos/not-a-uuid",
        headers=auth_headers(todo_detail_client),
    )

    assert missing_auth.status_code == 401
    assert missing_auth.json()["error"]["code"] == "unauthorized"
    assert bad_token.status_code == 401
    assert bad_token.json()["error"]["code"] == "unauthorized"
    assert invalid_uuid.status_code == 400
    assert invalid_uuid.json()["error"]["code"] == "validation_error"


def test_get_todo_does_not_require_or_persist_idempotency_key(todo_detail_client):
    response = todo_detail_client.get(
        f"/api/v1/todos/{todo_detail_client.todo_ids['active']}",
        headers={
            **auth_headers(todo_detail_client),
            "Idempotency-Key": str(uuid4()),
        },
    )

    assert response.status_code == 200
    assert row_counts(todo_detail_client) == {
        "todos": 6,
        "sync_changes": 0,
        "idempotency": 0,
    }


@pytest.fixture()
def todo_detail_client(tmp_path):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner"}
    user_ids = {"me": uuid4(), "partner": uuid4()}
    category_ids = {"active": uuid4(), "deleted": uuid4(), "partner": uuid4(), "missing": uuid4()}
    todo_ids = {}

    with TestingSessionLocal() as db:
        db.add_all(
            [
                User(
                    id=user_ids["me"],
                    alias="me",
                    display_name="Me",
                    bootstrap_token_hash=hasher.hash(tokens["me"]),
                    timezone="Asia/Shanghai",
                ),
                User(
                    id=user_ids["partner"],
                    alias="partner",
                    display_name="Partner",
                    bootstrap_token_hash=hasher.hash(tokens["partner"]),
                    timezone="Asia/Shanghai",
                ),
            ]
        )
        db.add_all(
            [
                TodoCategory(
                    id=category_ids["active"],
                    user_id=user_ids["me"],
                    name="Work",
                    is_inbox=False,
                    sort_order=1,
                ),
                TodoCategory(
                    id=category_ids["deleted"],
                    user_id=user_ids["me"],
                    name="Archived",
                    is_inbox=False,
                    sort_order=2,
                    deleted_at=datetime(2026, 7, 14),
                ),
                TodoCategory(
                    id=category_ids["partner"],
                    user_id=user_ids["partner"],
                    name="Partner Inbox",
                    is_inbox=True,
                    sort_order=0,
                ),
            ]
        )

        active = make_todo(user_id=user_ids["me"], category_id=category_ids["active"])
        deleted_category = make_todo(
            user_id=user_ids["me"],
            category_id=category_ids["deleted"],
            title="Archived category todo",
        )
        missing_category = make_todo(
            user_id=user_ids["me"],
            category_id=category_ids["missing"],
            title="Missing category todo",
        )
        null_category = make_todo(
            user_id=user_ids["me"],
            category_id=None,
            title="No category todo",
        )
        deleted_todo = make_todo(
            user_id=user_ids["me"],
            category_id=category_ids["active"],
            title="Deleted todo",
            deleted_at=datetime(2026, 7, 14),
        )
        partner = make_todo(
            user_id=user_ids["partner"],
            category_id=category_ids["partner"],
            title="Partner todo",
        )
        db.add_all([active, deleted_category, missing_category, null_category, deleted_todo, partner])
        db.commit()

        todo_ids.update(
            {
                "active": active.id,
                "deleted_category": deleted_category.id,
                "missing_category": missing_category.id,
                "null_category": null_category.id,
                "deleted_todo": deleted_todo.id,
                "partner": partner.id,
            }
        )

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        test_client.tokens = tokens
        test_client.user_ids = user_ids
        test_client.category_ids = category_ids
        test_client.todo_ids = todo_ids
        test_client.session_factory = TestingSessionLocal
        yield test_client
