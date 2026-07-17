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


def auth_headers(todo_complete_client, alias: str = "me", idempotency_key: str | None = None):
    headers = {"Authorization": f"Bearer {todo_complete_client.tokens[alias]}"}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def row_counts(todo_complete_client):
    with todo_complete_client.session_factory() as db:
        return {
            "todos": len(db.execute(select(Todo)).all()),
            "sync_changes": len(db.execute(select(SyncChange)).all()),
            "idempotency": len(db.execute(select(IdempotencyKey)).all()),
        }


def get_db_todo(todo_complete_client, todo_id):
    with todo_complete_client.session_factory() as db:
        return db.execute(select(Todo).where(Todo.id == todo_id)).scalar_one()


def test_complete_todo_transitions_pending_todo_and_writes_sync(todo_complete_client):
    todo_id = todo_complete_client.todo_ids["pending"]

    response = todo_complete_client.post(
        f"/api/v1/todos/{todo_id}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["id"] == str(todo_id)
    assert body["data"]["status"] == "completed"
    assert body["data"]["completed_at"] is not None
    assert body["data"]["updated_at"] == body["data"]["completed_at"]
    assert body["data"]["version"] == 2
    assert body["data"]["title"] == "Pending todo"
    assert body["data"]["note"] == "Keep this note"
    assert body["data"]["category_id"] == str(todo_complete_client.category_ids["active"])
    assert body["data"]["category"]["is_deleted"] is False
    assert body["sync"]["cursor"] == 1
    assert "user_id" not in body["data"]
    assert "deleted_at" not in body["data"]
    assert "canceled_at" not in body["data"]
    assert "recurring_template_id" not in body["data"]
    assert "source_client_id" not in body["data"]
    assert "client_created_id" not in body["data"]

    with todo_complete_client.session_factory() as db:
        todo = db.execute(select(Todo).where(Todo.id == todo_id)).scalar_one()
        assert todo.status == "completed"
        assert todo.completed_at == todo.updated_at
        assert todo.version == 2
        assert todo.canceled_at is None

        sync_change = db.execute(select(SyncChange)).scalar_one()
        assert sync_change.change_type == "todo.completed"
        assert sync_change.entity_type == "todo"
        assert sync_change.entity_id == todo_id
        assert sync_change.entity_version == 2
        assert sync_change.payload == {"snapshot": body["data"]}

        idempotency = db.execute(select(IdempotencyKey)).scalar_one()
        assert idempotency.response_body == body


def test_complete_todo_missing_cross_user_deleted_and_invalid_state_errors(todo_complete_client):
    missing = todo_complete_client.post(
        f"/api/v1/todos/{uuid4()}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )
    cross_user = todo_complete_client.post(
        f"/api/v1/todos/{todo_complete_client.todo_ids['partner']}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )
    deleted = todo_complete_client.post(
        f"/api/v1/todos/{todo_complete_client.todo_ids['deleted']}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )
    completed = todo_complete_client.post(
        f"/api/v1/todos/{todo_complete_client.todo_ids['completed']}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )
    canceled = todo_complete_client.post(
        f"/api/v1/todos/{todo_complete_client.todo_ids['canceled']}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )

    assert missing.status_code == 404
    assert cross_user.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"
    assert cross_user.json()["error"]["code"] == "not_found"
    assert missing.json()["error"]["message"] == cross_user.json()["error"]["message"]
    assert deleted.status_code == 410
    assert deleted.json()["error"]["code"] == "deleted_resource"
    assert completed.status_code == 400
    assert completed.json()["error"]["code"] == "invalid_state_transition"
    assert canceled.status_code == 400
    assert canceled.json()["error"]["code"] == "invalid_state_transition"
    assert row_counts(todo_complete_client) == {
        "todos": 7,
        "sync_changes": 0,
        "idempotency": 0,
    }


def test_complete_todo_idempotency_replay_conflict_and_new_key_after_completion(todo_complete_client):
    todo_id = todo_complete_client.todo_ids["pending"]
    key = str(uuid4())
    headers = auth_headers(todo_complete_client, idempotency_key=key)

    first = todo_complete_client.post(f"/api/v1/todos/{todo_id}/complete", headers=headers)
    replay = todo_complete_client.post(f"/api/v1/todos/{todo_id}/complete", headers=headers)
    conflict = todo_complete_client.post(f"/api/v1/todos/{todo_id}/complete?again=1", headers=headers)
    new_key = todo_complete_client.post(
        f"/api/v1/todos/{todo_id}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )

    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_key_conflict"
    assert new_key.status_code == 400
    assert new_key.json()["error"]["code"] == "invalid_state_transition"

    todo = get_db_todo(todo_complete_client, todo_id)
    assert todo.version == 2
    assert todo.status == "completed"
    assert row_counts(todo_complete_client) == {
        "todos": 7,
        "sync_changes": 1,
        "idempotency": 1,
    }


def test_complete_todo_serializes_deleted_and_missing_category_history(todo_complete_client):
    deleted_category = todo_complete_client.post(
        f"/api/v1/todos/{todo_complete_client.todo_ids['deleted_category']}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )
    missing_category = todo_complete_client.post(
        f"/api/v1/todos/{todo_complete_client.todo_ids['missing_category']}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )

    assert deleted_category.status_code == 200
    assert deleted_category.json()["data"]["category"] == {
        "id": str(todo_complete_client.category_ids["deleted"]),
        "name": "Archived",
        "is_deleted": True,
    }
    assert missing_category.status_code == 200
    assert missing_category.json()["data"]["category_id"] == str(todo_complete_client.category_ids["missing"])
    assert missing_category.json()["data"]["category"] is None


def test_complete_todo_auth_uuid_body_and_idempotency_key_conventions(todo_complete_client):
    todo_id = todo_complete_client.todo_ids["pending"]

    missing_key = todo_complete_client.post(
        f"/api/v1/todos/{todo_id}/complete",
        headers=auth_headers(todo_complete_client),
    )
    missing_auth = todo_complete_client.post(
        f"/api/v1/todos/{todo_id}/complete",
        headers={"Idempotency-Key": str(uuid4())},
    )
    bad_token = todo_complete_client.post(
        f"/api/v1/todos/{todo_id}/complete",
        headers={"Authorization": "Bearer wrong", "Idempotency-Key": str(uuid4())},
    )
    invalid_uuid = todo_complete_client.post(
        "/api/v1/todos/not-a-uuid/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
    )
    body = todo_complete_client.post(
        f"/api/v1/todos/{todo_id}/complete",
        headers=auth_headers(todo_complete_client, idempotency_key=str(uuid4())),
        json={"status": "completed"},
    )

    assert missing_key.status_code == 400
    assert missing_key.json()["error"]["code"] == "idempotency_key_required"
    assert missing_auth.status_code == 401
    assert missing_auth.json()["error"]["code"] == "unauthorized"
    assert bad_token.status_code == 401
    assert bad_token.json()["error"]["code"] == "unauthorized"
    assert invalid_uuid.status_code == 400
    assert invalid_uuid.json()["error"]["code"] == "validation_error"
    assert body.status_code == 400
    assert body.json()["error"]["code"] == "validation_error"
    assert row_counts(todo_complete_client) == {
        "todos": 7,
        "sync_changes": 0,
        "idempotency": 0,
    }


@pytest.fixture()
def todo_complete_client(tmp_path):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner"}
    user_ids = {"me": uuid4(), "partner": uuid4()}
    category_ids = {
        "active": uuid4(),
        "deleted": uuid4(),
        "partner": uuid4(),
        "missing": uuid4(),
    }
    todo_ids = {
        "pending": uuid4(),
        "completed": uuid4(),
        "canceled": uuid4(),
        "deleted": uuid4(),
        "partner": uuid4(),
        "deleted_category": uuid4(),
        "missing_category": uuid4(),
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
                    deleted_at=datetime(2026, 7, 17),
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
        db.add_all(
            [
                Todo(
                    id=todo_ids["pending"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Pending todo",
                    note="Keep this note",
                    status="pending",
                    priority="medium",
                    version=1,
                ),
                Todo(
                    id=todo_ids["completed"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Completed todo",
                    status="completed",
                    priority="medium",
                    completed_at=datetime(2026, 7, 17, 9, 0, 0),
                    version=2,
                ),
                Todo(
                    id=todo_ids["canceled"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Canceled todo",
                    status="canceled",
                    priority="low",
                    version=2,
                ),
                Todo(
                    id=todo_ids["deleted"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Deleted todo",
                    status="pending",
                    priority="medium",
                    version=1,
                    deleted_at=datetime(2026, 7, 17),
                ),
                Todo(
                    id=todo_ids["partner"],
                    user_id=user_ids["partner"],
                    category_id=category_ids["partner"],
                    title="Partner todo",
                    status="pending",
                    priority="medium",
                    version=1,
                ),
                Todo(
                    id=todo_ids["deleted_category"],
                    user_id=user_ids["me"],
                    category_id=category_ids["deleted"],
                    title="Deleted category todo",
                    status="pending",
                    priority="medium",
                    version=1,
                ),
                Todo(
                    id=todo_ids["missing_category"],
                    user_id=user_ids["me"],
                    category_id=category_ids["missing"],
                    title="Missing category todo",
                    status="pending",
                    priority="medium",
                    version=1,
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
        test_client.todo_ids = todo_ids
        test_client.session_factory = TestingSessionLocal
        yield test_client
