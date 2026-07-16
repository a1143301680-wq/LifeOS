from datetime import date, datetime
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


def auth_headers(todo_update_client, alias: str = "me", idempotency_key: str | None = None):
    headers = {"Authorization": f"Bearer {todo_update_client.tokens[alias]}"}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def row_counts(todo_update_client):
    with todo_update_client.session_factory() as db:
        return {
            "todos": len(db.execute(select(Todo)).all()),
            "sync_changes": len(db.execute(select(SyncChange)).all()),
            "idempotency": len(db.execute(select(IdempotencyKey)).all()),
        }


def get_db_todo(todo_update_client, todo_id):
    with todo_update_client.session_factory() as db:
        return db.execute(select(Todo).where(Todo.id == todo_id)).scalar_one()


def test_patch_todo_updates_allowed_fields_and_writes_sync(todo_update_client):
    todo_id = todo_update_client.todo_ids["pending"]
    before = get_db_todo(todo_update_client, todo_id)
    before_updated_at = before.updated_at

    response = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={
            "title": "  Updated title  ",
            "note": "Updated note",
            "category_id": str(todo_update_client.category_ids["work"]),
            "priority": "high",
            "planned_date": "2026-07-16",
            "due_at": "2026-07-16T11:00:00+08:00",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["title"] == "Updated title"
    assert body["data"]["note"] == "Updated note"
    assert body["data"]["category_id"] == str(todo_update_client.category_ids["work"])
    assert body["data"]["category"]["name"] == "Work"
    assert body["data"]["priority"] == "high"
    assert body["data"]["planned_date"] == "2026-07-16"
    assert body["data"]["due_at"] == "2026-07-16T11:00:00+08:00"
    assert body["data"]["status"] == "pending"
    assert body["data"]["completed_at"] is None
    assert body["data"]["version"] == 2
    assert body["sync"]["cursor"] == 1
    assert "user_id" not in body["data"]
    assert "deleted_at" not in body["data"]
    assert "recurring_template_id" not in body["data"]
    assert "source_client_id" not in body["data"]
    assert "client_created_id" not in body["data"]

    with todo_update_client.session_factory() as db:
        todo = db.execute(select(Todo).where(Todo.id == todo_id)).scalar_one()
        assert todo.title == "Updated title"
        assert todo.note == "Updated note"
        assert todo.category_id == todo_update_client.category_ids["work"]
        assert todo.priority == "high"
        assert todo.planned_date == date(2026, 7, 16)
        assert todo.version == 2
        assert todo.updated_at != before_updated_at

        sync_change = db.execute(select(SyncChange)).scalar_one()
        assert sync_change.change_type == "todo.updated"
        assert sync_change.entity_type == "todo"
        assert sync_change.entity_id == todo_id
        assert sync_change.entity_version == 2
        assert sync_change.payload == {"snapshot": body["data"]}

        idempotency = db.execute(select(IdempotencyKey)).scalar_one()
        assert idempotency.response_body == body


def test_patch_todo_omits_unchanged_fields_and_clears_nullable_fields(todo_update_client):
    todo_id = todo_update_client.todo_ids["pending"]

    response = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={
            "note": None,
            "category_id": None,
            "planned_date": None,
            "due_at": None,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["title"] == "Initial todo"
    assert body["data"]["priority"] == "medium"
    assert body["data"]["note"] is None
    assert body["data"]["category_id"] is None
    assert body["data"]["category"] is None
    assert body["data"]["planned_date"] is None
    assert body["data"]["due_at"] is None
    assert body["data"]["version"] == 2


def test_patch_todo_rejects_invalid_or_forbidden_payloads_without_side_effects(todo_update_client):
    todo_id = todo_update_client.todo_ids["pending"]
    invalid_payloads = [
        {},
        {"title": None},
        {"title": "   "},
        {"priority": None},
        {"priority": "urgent"},
        {"category_id": "not-a-uuid"},
        {"status": "completed"},
        {"completed_at": "2026-07-15T10:00:00+08:00"},
        {"deleted_at": "2026-07-15T10:00:00+08:00"},
        {"user_id": str(todo_update_client.user_ids["me"])},
        {"version": 99},
        {"created_at": "2026-07-15T10:00:00+08:00"},
        {"updated_at": "2026-07-15T10:00:00+08:00"},
        {"source_client_id": "phone"},
    ]

    for payload in invalid_payloads:
        response = todo_update_client.patch(
            f"/api/v1/todos/{todo_id}",
            headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
            json=payload,
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"

    todo = get_db_todo(todo_update_client, todo_id)
    assert todo.version == 1
    assert todo.title == "Initial todo"
    assert row_counts(todo_update_client) == {
        "todos": 5,
        "sync_changes": 0,
        "idempotency": 0,
    }


def test_patch_todo_missing_cross_user_and_deleted_todo_errors(todo_update_client):
    missing = todo_update_client.patch(
        f"/api/v1/todos/{uuid4()}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"title": "Nope"},
    )
    cross_user = todo_update_client.patch(
        f"/api/v1/todos/{todo_update_client.todo_ids['partner']}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"title": "Nope"},
    )
    deleted = todo_update_client.patch(
        f"/api/v1/todos/{todo_update_client.todo_ids['deleted']}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"title": "Nope"},
    )

    assert missing.status_code == 404
    assert cross_user.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"
    assert cross_user.json()["error"]["code"] == "not_found"
    assert missing.json()["error"]["message"] == cross_user.json()["error"]["message"]
    assert deleted.status_code == 410
    assert deleted.json()["error"]["code"] == "deleted_resource"
    assert row_counts(todo_update_client) == {
        "todos": 5,
        "sync_changes": 0,
        "idempotency": 0,
    }


def test_patch_todo_category_ownership_and_deleted_errors(todo_update_client):
    todo_id = todo_update_client.todo_ids["pending"]

    ok = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"category_id": str(todo_update_client.category_ids["work"])},
    )
    missing = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"category_id": str(uuid4())},
    )
    cross_user = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"category_id": str(todo_update_client.category_ids["partner"])},
    )
    deleted = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"category_id": str(todo_update_client.category_ids["deleted"])},
    )

    assert ok.status_code == 200
    assert ok.json()["data"]["category_id"] == str(todo_update_client.category_ids["work"])
    assert missing.status_code == 404
    assert cross_user.status_code == 404
    assert missing.json()["error"]["code"] == "not_found"
    assert cross_user.json()["error"]["code"] == "not_found"
    assert deleted.status_code == 410
    assert deleted.json()["error"]["code"] == "deleted_resource"


def test_patch_todo_edits_completed_and_canceled_without_changing_status(todo_update_client):
    completed = todo_update_client.patch(
        f"/api/v1/todos/{todo_update_client.todo_ids['completed']}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"title": "Completed edited"},
    )
    canceled = todo_update_client.patch(
        f"/api/v1/todos/{todo_update_client.todo_ids['canceled']}",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"title": "Canceled edited"},
    )

    assert completed.status_code == 200
    assert completed.json()["data"]["status"] == "completed"
    assert completed.json()["data"]["completed_at"] == "2026-07-14T09:00:00"
    assert canceled.status_code == 200
    assert canceled.json()["data"]["status"] == "canceled"


def test_patch_todo_idempotency_replay_and_conflict(todo_update_client):
    todo_id = todo_update_client.todo_ids["pending"]
    key = str(uuid4())
    headers = auth_headers(todo_update_client, idempotency_key=key)

    first = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=headers,
        json={"title": "Replay update"},
    )
    replay = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=headers,
        json={"title": "Replay update"},
    )
    conflict = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=headers,
        json={"title": "Different update"},
    )

    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_key_conflict"

    todo = get_db_todo(todo_update_client, todo_id)
    assert todo.version == 2
    assert todo.title == "Replay update"
    assert row_counts(todo_update_client) == {
        "todos": 5,
        "sync_changes": 1,
        "idempotency": 1,
    }


def test_patch_todo_requires_idempotency_key_and_auth(todo_update_client):
    todo_id = todo_update_client.todo_ids["pending"]

    missing_key = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(todo_update_client),
        json={"title": "No key"},
    )
    missing_auth = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers={"Idempotency-Key": str(uuid4())},
        json={"title": "No auth"},
    )
    bad_token = todo_update_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers={"Authorization": "Bearer wrong", "Idempotency-Key": str(uuid4())},
        json={"title": "Bad auth"},
    )
    invalid_path_uuid = todo_update_client.patch(
        "/api/v1/todos/not-a-uuid",
        headers=auth_headers(todo_update_client, idempotency_key=str(uuid4())),
        json={"title": "Bad path"},
    )

    assert missing_key.status_code == 400
    assert missing_key.json()["error"]["code"] == "idempotency_key_required"
    assert missing_auth.status_code == 401
    assert missing_auth.json()["error"]["code"] == "unauthorized"
    assert bad_token.status_code == 401
    assert bad_token.json()["error"]["code"] == "unauthorized"
    assert invalid_path_uuid.status_code == 400
    assert invalid_path_uuid.json()["error"]["code"] == "validation_error"
    assert row_counts(todo_update_client) == {
        "todos": 5,
        "sync_changes": 0,
        "idempotency": 0,
    }


@pytest.fixture()
def todo_update_client(tmp_path):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner"}
    user_ids = {"me": uuid4(), "partner": uuid4()}
    category_ids = {
        "inbox": uuid4(),
        "work": uuid4(),
        "deleted": uuid4(),
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
                    id=category_ids["inbox"],
                    user_id=user_ids["me"],
                    name="Inbox",
                    is_inbox=True,
                    sort_order=0,
                ),
                TodoCategory(
                    id=category_ids["work"],
                    user_id=user_ids["me"],
                    name="Work",
                    is_inbox=False,
                    sort_order=1,
                ),
                TodoCategory(
                    id=category_ids["deleted"],
                    user_id=user_ids["me"],
                    name="Deleted",
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
        db.add_all(
            [
                Todo(
                    id=todo_ids["pending"],
                    user_id=user_ids["me"],
                    category_id=category_ids["inbox"],
                    title="Initial todo",
                    note="Initial note",
                    status="pending",
                    priority="medium",
                    planned_date=date(2026, 7, 15),
                    due_at=datetime(2026, 7, 15, 10, 0, 0),
                    version=1,
                ),
                Todo(
                    id=todo_ids["completed"],
                    user_id=user_ids["me"],
                    category_id=category_ids["inbox"],
                    title="Completed todo",
                    status="completed",
                    priority="medium",
                    completed_at=datetime(2026, 7, 14, 9, 0, 0),
                    version=3,
                ),
                Todo(
                    id=todo_ids["canceled"],
                    user_id=user_ids["me"],
                    category_id=category_ids["inbox"],
                    title="Canceled todo",
                    status="canceled",
                    priority="low",
                    version=2,
                ),
                Todo(
                    id=todo_ids["deleted"],
                    user_id=user_ids["me"],
                    category_id=category_ids["inbox"],
                    title="Deleted todo",
                    status="pending",
                    priority="medium",
                    version=1,
                    deleted_at=datetime(2026, 7, 14),
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
