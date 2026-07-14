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


@pytest.fixture()
def todo_client(tmp_path):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner"}
    user_ids = {"me": uuid4(), "partner": uuid4()}
    category_ids = {
        "me_inbox": uuid4(),
        "me_work": uuid4(),
        "partner_inbox": uuid4(),
        "deleted": uuid4(),
    }
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
                    id=category_ids["me_inbox"],
                    user_id=user_ids["me"],
                    name="Inbox",
                    color="#64748b",
                    icon="inbox",
                    is_inbox=True,
                    sort_order=0,
                ),
                TodoCategory(
                    id=category_ids["me_work"],
                    user_id=user_ids["me"],
                    name="Work",
                    color="#22c55e",
                    icon="briefcase",
                    is_inbox=False,
                    sort_order=1,
                ),
                TodoCategory(
                    id=category_ids["partner_inbox"],
                    user_id=user_ids["partner"],
                    name="Partner Inbox",
                    color="#64748b",
                    icon="inbox",
                    is_inbox=True,
                    sort_order=0,
                ),
                TodoCategory(
                    id=category_ids["deleted"],
                    user_id=user_ids["me"],
                    name="Deleted",
                    is_inbox=False,
                    sort_order=99,
                    deleted_at=datetime(2026, 7, 13),
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
        test_client.category_ids = category_ids
        test_client.session_factory = TestingSessionLocal
        yield test_client


def auth_headers(todo_client, alias: str = "me", idempotency_key: str | None = None):
    headers = {"Authorization": f"Bearer {todo_client.tokens[alias]}"}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def count_rows(todo_client):
    with todo_client.session_factory() as db:
        return {
            "todos": len(db.execute(select(Todo)).all()),
            "sync_changes": len(db.execute(select(SyncChange)).all()),
            "idempotency": len(db.execute(select(IdempotencyKey)).all()),
        }


def test_create_todo_defaults_to_current_user_inbox_and_writes_sync(todo_client):
    response = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client, idempotency_key=str(uuid4())),
        json={"title": "  Feed birds  "},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["data"]["title"] == "Feed birds"
    assert body["data"]["category_id"] == str(todo_client.category_ids["me_inbox"])
    assert body["data"]["category"]["name"] == "Inbox"
    assert body["data"]["category"]["is_deleted"] is False
    assert body["data"]["status"] == "pending"
    assert body["data"]["priority"] == "medium"
    assert body["data"]["version"] == 1
    assert body["data"]["completed_at"] is None
    assert body["sync"]["cursor"] == 1
    assert "user_id" not in body["data"]
    assert "deleted_at" not in body["data"]

    with todo_client.session_factory() as db:
        todo = db.execute(select(Todo)).scalar_one()
        assert todo.user_id == todo_client.user_ids["me"]
        assert todo.category_id == todo_client.category_ids["me_inbox"]
        assert todo.status == "pending"
        assert todo.version == 1

        sync_change = db.execute(select(SyncChange)).scalar_one()
        assert sync_change.change_type == "todo.created"
        assert sync_change.entity_type == "todo"
        assert sync_change.entity_id == todo.id
        assert sync_change.entity_version == 1
        assert sync_change.payload == {"snapshot": body["data"]}


def test_create_todo_accepts_supplied_owned_active_category_and_client_uuid(todo_client):
    todo_id = uuid4()
    response = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client, idempotency_key=str(uuid4())),
        json={
            "id": str(todo_id),
            "title": "Plan work",
            "note": "Draft outline",
            "category_id": str(todo_client.category_ids["me_work"]),
            "priority": "high",
            "planned_date": "2026-07-14",
            "due_at": "2026-07-14T10:00:00+08:00",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["data"]["id"] == str(todo_id)
    assert body["data"]["category_id"] == str(todo_client.category_ids["me_work"])
    assert body["data"]["category"]["name"] == "Work"
    assert body["data"]["note"] == "Draft outline"
    assert body["data"]["priority"] == "high"
    assert body["data"]["planned_date"] == "2026-07-14"
    assert body["data"]["due_at"] == "2026-07-14T10:00:00+08:00"


def test_create_todo_returns_404_for_missing_or_cross_user_category(todo_client):
    missing = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client, idempotency_key=str(uuid4())),
        json={"title": "Missing category", "category_id": str(uuid4())},
    )
    cross_user = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client, idempotency_key=str(uuid4())),
        json={"title": "Cross user category", "category_id": str(todo_client.category_ids["partner_inbox"])},
    )

    assert missing.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"
    assert cross_user.status_code == 404
    assert cross_user.json()["error"]["code"] == "not_found"
    assert count_rows(todo_client) == {"todos": 0, "sync_changes": 0, "idempotency": 0}


def test_create_todo_returns_deleted_resource_for_soft_deleted_owned_category(todo_client):
    response = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client, idempotency_key=str(uuid4())),
        json={"title": "Deleted category", "category_id": str(todo_client.category_ids["deleted"])},
    )

    assert response.status_code == 410
    assert response.json()["error"]["code"] == "deleted_resource"
    assert count_rows(todo_client) == {"todos": 0, "sync_changes": 0, "idempotency": 0}


def test_create_todo_requires_and_replays_idempotency_key(todo_client):
    missing_key = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client),
        json={"title": "No key"},
    )
    assert missing_key.status_code == 400
    assert missing_key.json()["error"]["code"] == "idempotency_key_required"

    key = str(uuid4())
    headers = auth_headers(todo_client, idempotency_key=key)
    payload = {"title": "Replay me"}
    first = todo_client.post("/api/v1/todos", headers=headers, json=payload)
    replay = todo_client.post("/api/v1/todos", headers=headers, json=payload)
    conflict = todo_client.post("/api/v1/todos", headers=headers, json={"title": "Different"})

    assert first.status_code == 201
    assert replay.status_code == 201
    assert replay.json() == first.json()
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_key_conflict"

    with todo_client.session_factory() as db:
        assert len(db.execute(select(Todo)).all()) == 1
        assert len(db.execute(select(SyncChange)).all()) == 1
        assert len(db.execute(select(IdempotencyKey)).all()) == 1


def test_create_todo_rejects_invalid_fields_and_values(todo_client):
    cases = [
        {"title": "   "},
        {"title": "Bad priority", "priority": "urgent"},
        {"title": "Bad id", "id": "not-a-uuid"},
        {"title": "User leak", "user_id": str(todo_client.user_ids["me"])},
        {"title": "Status leak", "status": "completed"},
        {"title": "Version leak", "version": 9},
        {"title": "Sync leak", "sync": {"cursor": 1}},
        {"title": "Deleted leak", "deleted_at": "2026-07-13T00:00:00+08:00"},
    ]

    for payload in cases:
        response = todo_client.post(
            "/api/v1/todos",
            headers=auth_headers(todo_client, idempotency_key=str(uuid4())),
            json=payload,
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"

    assert count_rows(todo_client) == {"todos": 0, "sync_changes": 0, "idempotency": 0}


def test_create_todo_rejects_client_uuid_collision_without_user_leak(todo_client):
    existing_id = uuid4()
    with todo_client.session_factory() as db:
        db.add(
            Todo(
                id=existing_id,
                user_id=todo_client.user_ids["partner"],
                category_id=todo_client.category_ids["partner_inbox"],
                title="Partner todo",
                status="pending",
                priority="medium",
                version=1,
            )
        )
        db.commit()

    response = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client, idempotency_key=str(uuid4())),
        json={"id": str(existing_id), "title": "Collide"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"

    with todo_client.session_factory() as db:
        assert len(db.execute(select(Todo)).scalars().all()) == 1
        assert len(db.execute(select(SyncChange)).all()) == 0
        assert len(db.execute(select(IdempotencyKey)).all()) == 0


def test_create_todo_uses_current_users_inbox_for_each_user(todo_client):
    me_response = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client, "me", str(uuid4())),
        json={"title": "My todo"},
    )
    partner_response = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client, "partner", str(uuid4())),
        json={"title": "Partner todo"},
    )

    assert me_response.status_code == 201
    assert partner_response.status_code == 201
    assert me_response.json()["data"]["category_id"] == str(todo_client.category_ids["me_inbox"])
    assert partner_response.json()["data"]["category_id"] == str(todo_client.category_ids["partner_inbox"])

    with todo_client.session_factory() as db:
        todos = db.execute(select(Todo).order_by(Todo.title)).scalars().all()
        assert {todo.user_id for todo in todos} == {
            todo_client.user_ids["me"],
            todo_client.user_ids["partner"],
        }


def test_create_todo_rejects_invalid_inbox_invariant(todo_client):
    with todo_client.session_factory() as db:
        db.add(
            TodoCategory(
                user_id=todo_client.user_ids["me"],
                name="Second Inbox",
                is_inbox=True,
                sort_order=10,
            )
        )
        db.commit()

    response = todo_client.post(
        "/api/v1/todos",
        headers=auth_headers(todo_client, idempotency_key=str(uuid4())),
        json={"title": "No stable inbox"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_state_transition"
    assert count_rows(todo_client) == {"todos": 0, "sync_changes": 0, "idempotency": 0}
