from datetime import datetime
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
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
    category_ids = {"me_inbox": uuid4(), "partner_inbox": uuid4(), "deleted": uuid4()}
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
        test_client.category_ids = category_ids
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


def test_create_category_rejects_active_duplicate_name_with_friendly_error(category_client):
    response = category_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Inbox"},
    )

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == "category name already exists"


def test_database_rejects_active_duplicate_category_name(category_client):
    with category_client.session_factory() as db:
        db.add(
            TodoCategory(
                user_id=category_client.user_ids["me"],
                name="Inbox",
                is_inbox=False,
                sort_order=10,
            )
        )

        with pytest.raises(IntegrityError):
            db.commit()


def test_create_category_allows_reusing_soft_deleted_name(category_client):
    response = category_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Deleted"},
    )

    assert response.status_code == 201
    assert response.json()["data"]["name"] == "Deleted"

    with category_client.session_factory() as db:
        rows = db.execute(
            select(TodoCategory).where(
                TodoCategory.user_id == category_client.user_ids["me"],
                TodoCategory.name == "Deleted",
            )
        ).scalars().all()
        assert len(rows) == 2
        assert sum(row.deleted_at is None for row in rows) == 1


def test_update_category_updates_allowed_fields_and_writes_sync_change(category_client):
    create = category_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Work"},
    )
    category_id = create.json()["data"]["id"]

    response = category_client.patch(
        f"/api/v1/todo-categories/{category_id}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Office", "color": "#111827", "icon": "briefcase", "sort_order": 7},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["name"] == "Office"
    assert body["data"]["color"] == "#111827"
    assert body["data"]["icon"] == "briefcase"
    assert body["data"]["sort_order"] == 7
    assert body["sync"]["cursor"] == 2
    assert "user_id" not in body["data"]

    with category_client.session_factory() as db:
        sync_changes = db.execute(select(SyncChange).order_by(SyncChange.cursor)).scalars().all()
        assert [change.change_type for change in sync_changes] == [
            "category.created",
            "category.updated",
        ]


def test_update_category_requires_idempotency_key(category_client):
    response = category_client.patch(
        f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}",
        headers=auth_headers(category_client),
        json={"color": "#000000"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "idempotency_key_required"


def test_update_category_rejects_forbidden_system_fields(category_client):
    response = category_client.patch(
        f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"is_inbox": False},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"

    response = category_client.patch(
        f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"user_id": str(uuid4())},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_update_category_rejects_null_name_and_sort_order(category_client):
    name_response = category_client.patch(
        f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": None},
    )
    sort_order_response = category_client.patch(
        f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"sort_order": None},
    )

    assert name_response.status_code == 400
    assert name_response.json()["error"]["code"] == "validation_error"
    assert sort_order_response.status_code == 400
    assert sort_order_response.json()["error"]["code"] == "validation_error"


def test_update_category_allows_null_color_and_icon_to_clear_fields(category_client):
    response = category_client.patch(
        f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"color": None, "icon": None},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["color"] is None
    assert body["data"]["icon"] is None


def test_update_inbox_display_fields_but_not_identity(category_client):
    response = category_client.patch(
        f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Main Inbox", "color": "#ffffff", "icon": "tray", "sort_order": 4},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["name"] == "Main Inbox"
    assert body["data"]["is_inbox"] is True


def test_update_category_rejects_duplicate_active_name(category_client):
    create = category_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Work"},
    )
    category_id = create.json()["data"]["id"]

    response = category_client.patch(
        f"/api/v1/todo-categories/{category_id}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Inbox"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
    assert response.json()["error"]["message"] == "category name already exists"


def test_update_category_returns_404_for_cross_user_category(category_client):
    response = category_client.patch(
        f"/api/v1/todo-categories/{category_client.category_ids['partner_inbox']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"color": "#000000"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_update_deleted_category_returns_deleted_resource(category_client):
    response = category_client.patch(
        f"/api/v1/todo-categories/{category_client.category_ids['deleted']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Recovered"},
    )

    assert response.status_code == 410
    assert response.json()["error"]["code"] == "deleted_resource"


def test_update_category_replays_same_idempotency_key_and_rejects_conflict(category_client):
    key = str(uuid4())
    url = f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}"
    headers = auth_headers(category_client, idempotency_key=key)

    first = category_client.patch(url, headers=headers, json={"color": "#111111"})
    replay = category_client.patch(url, headers=headers, json={"color": "#111111"})
    conflict = category_client.patch(url, headers=headers, json={"color": "#222222"})

    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_key_conflict"


def test_delete_category_soft_deletes_and_writes_sync_change(category_client):
    create = category_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Temp"},
    )
    category_id = create.json()["data"]["id"]

    response = category_client.delete(
        f"/api/v1/todo-categories/{category_id}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["id"] == category_id
    assert body["data"]["deleted"] is True
    assert body["sync"]["cursor"] == 2

    with category_client.session_factory() as db:
        category = db.execute(select(TodoCategory).where(TodoCategory.id == category_id)).scalar_one()
        assert category.deleted_at is not None
        sync_changes = db.execute(select(SyncChange).order_by(SyncChange.cursor)).scalars().all()
        assert [change.change_type for change in sync_changes] == [
            "category.created",
            "category.deleted",
        ]


def test_delete_category_requires_idempotency_key(category_client):
    response = category_client.delete(
        f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}",
        headers=auth_headers(category_client),
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "idempotency_key_required"


def test_delete_inbox_category_is_rejected(category_client):
    response = category_client.delete(
        f"/api/v1/todo-categories/{category_client.category_ids['me_inbox']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_state_transition"


def test_delete_category_returns_404_for_cross_user_category(category_client):
    response = category_client.delete(
        f"/api/v1/todo-categories/{category_client.category_ids['partner_inbox']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_delete_deleted_category_returns_deleted_resource(category_client):
    response = category_client.delete(
        f"/api/v1/todo-categories/{category_client.category_ids['deleted']}",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
    )

    assert response.status_code == 410
    assert response.json()["error"]["code"] == "deleted_resource"


def test_delete_category_replays_same_idempotency_key_and_rejects_conflict(category_client):
    create = category_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(category_client, idempotency_key=str(uuid4())),
        json={"name": "Disposable"},
    )
    category_id = create.json()["data"]["id"]
    key = str(uuid4())
    url = f"/api/v1/todo-categories/{category_id}"
    headers = auth_headers(category_client, idempotency_key=key)

    first = category_client.delete(url, headers=headers)
    replay = category_client.delete(url, headers=headers)
    conflict = category_client.delete(f"{url}?reason=again", headers=headers)

    assert first.status_code == 200
    assert replay.status_code == 200
    assert replay.json() == first.json()
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_key_conflict"
