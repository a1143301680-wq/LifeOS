from datetime import datetime
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

import app.api.v1.todos as todos_api
from app.core.database import Base, get_db
from app.main import create_app
from app.models.idempotency import IdempotencyKey
from app.models.sync import SyncChange
from app.models.todo import Todo
from app.models.todo_category import TodoCategory
from app.models.user import User


def auth_headers(todo_delete_client, alias: str = "me", idempotency_key: str | None = None):
    headers = {"Authorization": f"Bearer {todo_delete_client.tokens[alias]}"}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def row_counts(todo_delete_client):
    with todo_delete_client.session_factory() as db:
        return {
            "todos": len(db.execute(select(Todo)).all()),
            "sync_changes": len(db.execute(select(SyncChange)).all()),
            "idempotency": len(db.execute(select(IdempotencyKey)).all()),
        }


def get_db_todo(todo_delete_client, todo_id):
    with todo_delete_client.session_factory() as db:
        return db.execute(select(Todo).where(Todo.id == todo_id)).scalar_one()


def delete_todo(todo_delete_client, name: str, idempotency_key: str | None = None):
    return todo_delete_client.delete(
        f"/api/v1/todos/{todo_delete_client.todo_ids[name]}",
        headers=auth_headers(
            todo_delete_client,
            idempotency_key=idempotency_key or str(uuid4()),
        ),
    )


def test_delete_pending_todo_returns_tombstone_and_writes_sync(todo_delete_client):
    todo_id = todo_delete_client.todo_ids["pending"]

    response = delete_todo(todo_delete_client, "pending")

    assert response.status_code == 200
    body = response.json()
    assert body["data"] == {
        "id": str(todo_id),
        "deleted": True,
        "deleted_at": body["data"]["deleted_at"],
        "version": 2,
    }
    assert body["data"]["deleted_at"] is not None
    assert body["sync"]["cursor"] == 1
    assert set(body["data"].keys()) == {"id", "deleted", "deleted_at", "version"}

    with todo_delete_client.session_factory() as db:
        todo = db.execute(select(Todo).where(Todo.id == todo_id)).scalar_one()
        assert todo.status == "pending"
        assert todo.completed_at is None
        assert todo.canceled_at is None
        assert todo.title == "Pending todo"
        assert todo.category_id == todo_delete_client.category_ids["active"]
        assert todo.deleted_at is not None
        assert todo.updated_at == todo.deleted_at
        assert todo.version == 2

        sync_change = db.execute(select(SyncChange)).scalar_one()
        assert sync_change.change_type == "todo.deleted"
        assert sync_change.entity_type == "todo"
        assert sync_change.entity_id == todo_id
        assert sync_change.entity_version == 2
        assert sync_change.payload == body["data"]

        idempotency = db.execute(select(IdempotencyKey)).scalar_one()
        assert idempotency.response_body == body


def test_delete_all_active_statuses_preserves_lifecycle_history(todo_delete_client):
    pending = delete_todo(todo_delete_client, "pending")
    completed = delete_todo(todo_delete_client, "completed")
    canceled = delete_todo(todo_delete_client, "canceled")

    assert pending.status_code == 200
    assert completed.status_code == 200
    assert canceled.status_code == 200

    pending_todo = get_db_todo(todo_delete_client, todo_delete_client.todo_ids["pending"])
    completed_todo = get_db_todo(todo_delete_client, todo_delete_client.todo_ids["completed"])
    canceled_todo = get_db_todo(todo_delete_client, todo_delete_client.todo_ids["canceled"])
    assert pending_todo.status == "pending"
    assert completed_todo.status == "completed"
    assert completed_todo.completed_at == datetime(2026, 7, 17, 9, 0, 0)
    assert canceled_todo.status == "canceled"
    assert canceled_todo.canceled_at == datetime(2026, 7, 17, 10, 0, 0)
    assert row_counts(todo_delete_client) == {
        "todos": 5,
        "sync_changes": 3,
        "idempotency": 3,
    }


def test_delete_todo_missing_cross_user_and_already_deleted_errors(todo_delete_client):
    missing = todo_delete_client.delete(
        f"/api/v1/todos/{uuid4()}",
        headers=auth_headers(todo_delete_client, idempotency_key=str(uuid4())),
    )
    cross_user = delete_todo(todo_delete_client, "partner")
    deleted = delete_todo(todo_delete_client, "deleted")

    assert missing.status_code == 404
    assert cross_user.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"
    assert cross_user.json()["error"]["code"] == "not_found"
    assert missing.json()["error"]["message"] == cross_user.json()["error"]["message"]
    assert deleted.status_code == 410
    assert deleted.json()["error"]["code"] == "deleted_resource"
    assert row_counts(todo_delete_client) == {
        "todos": 5,
        "sync_changes": 0,
        "idempotency": 0,
    }


def test_delete_todo_idempotency_replay_conflict_and_new_key_after_delete(todo_delete_client):
    todo_id = todo_delete_client.todo_ids["pending"]
    key = str(uuid4())
    headers = auth_headers(todo_delete_client, idempotency_key=key)

    first = todo_delete_client.delete(f"/api/v1/todos/{todo_id}", headers=headers)
    replay = todo_delete_client.delete(f"/api/v1/todos/{todo_id}", headers=headers)
    conflict = todo_delete_client.delete(f"/api/v1/todos/{todo_id}?again=1", headers=headers)
    new_key = todo_delete_client.delete(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_delete_client, idempotency_key=str(uuid4())),
    )

    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_key_conflict"
    assert new_key.status_code == 410
    assert new_key.json()["error"]["code"] == "deleted_resource"

    todo = get_db_todo(todo_delete_client, todo_id)
    assert todo.version == 2
    assert todo.deleted_at is not None
    assert row_counts(todo_delete_client) == {
        "todos": 5,
        "sync_changes": 1,
        "idempotency": 1,
    }


def test_delete_todo_auth_uuid_body_and_idempotency_key_conventions(todo_delete_client):
    todo_id = todo_delete_client.todo_ids["pending"]

    missing_key = todo_delete_client.delete(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_delete_client),
    )
    missing_auth = todo_delete_client.delete(
        f"/api/v1/todos/{todo_id}",
        headers={"Idempotency-Key": str(uuid4())},
    )
    bad_token = todo_delete_client.delete(
        f"/api/v1/todos/{todo_id}",
        headers={"Authorization": "Bearer wrong", "Idempotency-Key": str(uuid4())},
    )
    invalid_uuid = todo_delete_client.delete(
        "/api/v1/todos/not-a-uuid",
        headers=auth_headers(todo_delete_client, idempotency_key=str(uuid4())),
    )
    body = todo_delete_client.request(
        "DELETE",
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_delete_client, idempotency_key=str(uuid4())),
        json={"deleted": True},
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
    assert row_counts(todo_delete_client) == {
        "todos": 5,
        "sync_changes": 0,
        "idempotency": 0,
    }


def test_delete_todo_rolls_back_mutation_when_sync_write_fails(todo_delete_client, monkeypatch):
    todo_id = todo_delete_client.todo_ids["pending"]

    def fail_sync_write(*args, **kwargs):
        raise RuntimeError("sync write failed")

    monkeypatch.setattr(todos_api, "create_sync_change", fail_sync_write)

    with pytest.raises(RuntimeError, match="sync write failed"):
        delete_todo(todo_delete_client, "pending")

    todo = get_db_todo(todo_delete_client, todo_id)
    assert todo.status == "pending"
    assert todo.deleted_at is None
    assert todo.version == 1
    assert row_counts(todo_delete_client) == {
        "todos": 5,
        "sync_changes": 0,
        "idempotency": 0,
    }


@pytest.fixture()
def todo_delete_client(tmp_path):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner"}
    user_ids = {"me": uuid4(), "partner": uuid4()}
    category_ids = {
        "active": uuid4(),
        "partner": uuid4(),
    }
    todo_ids = {
        "pending": uuid4(),
        "completed": uuid4(),
        "canceled": uuid4(),
        "deleted": uuid4(),
        "partner": uuid4(),
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
                    canceled_at=datetime(2026, 7, 17, 10, 0, 0),
                    version=3,
                ),
                Todo(
                    id=todo_ids["deleted"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Deleted todo",
                    status="completed",
                    priority="medium",
                    completed_at=datetime(2026, 7, 17, 9, 0, 0),
                    version=4,
                    deleted_at=datetime(2026, 7, 17, 11, 0, 0),
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
