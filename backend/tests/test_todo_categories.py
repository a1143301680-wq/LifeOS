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
from app.models.todo_category import TodoCategory
from app.models.user import User


@pytest.fixture()
def category_client(tmp_path):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner"}
    user_ids = {"me": uuid4(), "partner": uuid4()}
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
                    user_id=user_ids["me"],
                    name="Inbox",
                    color="#64748b",
                    icon="inbox",
                    is_inbox=True,
                    sort_order=0,
                ),
                TodoCategory(
                    user_id=user_ids["partner"],
                    name="Partner Inbox",
                    color="#64748b",
                    icon="inbox",
                    is_inbox=True,
                    sort_order=0,
                ),
                TodoCategory(
                    user_id=user_ids["me"],
                    name="Deleted",
                    is_inbox=False,
                    sort_order=99,
                    deleted_at=datetime(2026, 7, 11),
                ),
            ]
        )
        db.commit()

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
        test_client.session_factory = TestingSessionLocal
        yield test_client


def auth_headers(category_client, alias: str = "me", idempotency_key: str | None = None):
    headers = {"Authorization": f"Bearer {category_client.tokens[alias]}"}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def test_list_categories_returns_current_user_active_categories_only(category_client):
    response = category_client.get(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client),
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["name"] for item in body["items"]] == ["Inbox"]
    assert "server_time" in body
    assert "user_id" not in body["items"][0]


def test_create_category_writes_category_sync_change_and_idempotency_record(category_client):
    key = str(uuid4())
    response = category_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client, idempotency_key=key),
        json={"name": "Work", "color": "#22c55e", "icon": "briefcase"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["data"]["name"] == "Work"
    assert body["data"]["sort_order"] == 1
    assert body["sync"]["cursor"] == 1
    assert "user_id" not in body["data"]

    with category_client.session_factory() as db:
        category = db.execute(
            select(TodoCategory).where(TodoCategory.name == "Work")
        ).scalar_one()
        assert category.user_id == category_client.user_ids["me"]

        sync_change = db.execute(select(SyncChange)).scalar_one()
        assert sync_change.cursor == 1
        assert sync_change.change_type == "category.created"
        assert sync_change.entity_id == category.id

        idempotency_record = db.execute(select(IdempotencyKey)).scalar_one()
        assert str(idempotency_record.key) == key
        assert idempotency_record.response_body == body


def test_create_category_requires_idempotency_key(category_client):
    response = category_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client),
        json={"name": "Work"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "idempotency_key_required"


def test_create_category_replays_same_idempotency_key_and_request(category_client):
    key = str(uuid4())
    headers = auth_headers(category_client, idempotency_key=key)
    payload = {"name": "Study", "color": "#0ea5e9"}

    first = category_client.post("/api/v1/todo-categories", headers=headers, json=payload)
    second = category_client.post("/api/v1/todo-categories", headers=headers, json=payload)

    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json() == first.json()

    with category_client.session_factory() as db:
        assert len(db.execute(select(TodoCategory).where(TodoCategory.name == "Study")).all()) == 1
        assert len(db.execute(select(SyncChange)).all()) == 1
        assert len(db.execute(select(IdempotencyKey)).all()) == 1


def test_create_category_rejects_idempotency_key_conflict(category_client):
    key = str(uuid4())
    headers = auth_headers(category_client, idempotency_key=key)

    first = category_client.post(
        "/api/v1/todo-categories",
        headers=headers,
        json={"name": "Life"},
    )
    second = category_client.post(
        "/api/v1/todo-categories",
        headers=headers,
        json={"name": "Health"},
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "idempotency_key_conflict"


def test_create_category_rejects_client_supplied_user_id(category_client):
    response = category_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Work", "user_id": str(uuid4())},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
