from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

import app.services.sync as sync_service
from app.core.database import Base, get_db
from app.main import create_app
from app.models.idempotency import IdempotencyKey
from app.models.sync import SyncChange
from app.models.user import User


def auth_headers(sync_client, alias: str = "me"):
    return {"Authorization": f"Bearer {sync_client.tokens[alias]}"}


def get_changes(sync_client, params=None, alias: str = "me"):
    return sync_client.get(
        "/api/v1/sync/changes",
        headers=auth_headers(sync_client, alias=alias),
        params=params or {},
    )


def row_counts(sync_client):
    with sync_client.session_factory() as db:
        return {
            "sync_changes": len(db.execute(select(SyncChange)).all()),
            "idempotency": len(db.execute(select(IdempotencyKey)).all()),
        }


def test_sync_changes_default_envelope_order_payloads_and_no_writes(sync_client):
    before = row_counts(sync_client)

    response = get_changes(sync_client)

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"items", "next_cursor", "has_more", "server_time"}
    assert body["next_cursor"] == 9
    assert body["has_more"] is False
    assert [item["cursor"] for item in body["items"]] == [1, 3, 5, 7, 9]
    assert body["items"][0] == {
        "cursor": 1,
        "change_type": "todo.created",
        "entity_type": "todo",
        "entity_id": str(sync_client.entity_ids["todo_one"]),
        "entity_version": 1,
        "snapshot": {"id": "todo-one", "title": "Original"},
    }
    assert body["items"][2] == {
        "cursor": 5,
        "change_type": "todo.deleted",
        "entity_type": "todo",
        "entity_id": str(sync_client.entity_ids["todo_one"]),
        "entity_version": 3,
        "deleted": True,
        "deleted_at": "2026-07-21T09:00:00+08:00",
    }
    assert body["items"][4] == {
        "cursor": 9,
        "change_type": "sync.refresh",
        "entity_type": "system",
        "entity_id": None,
        "entity_version": None,
    }
    for item in body["items"]:
        assert "id" not in item
        assert "user_id" not in item
        assert "payload" not in item
        assert "created_at" not in item

    assert row_counts(sync_client) == before


def test_sync_changes_user_isolation_and_global_gap_advancement(sync_client):
    partner = get_changes(sync_client, alias="partner")
    no_rows = get_changes(sync_client, alias="empty")

    assert partner.status_code == 200
    assert [item["cursor"] for item in partner.json()["items"]] == [2, 4, 8]
    assert partner.json()["next_cursor"] == 9
    assert partner.json()["has_more"] is False
    assert all(
        item["snapshot"]["owner"] == "partner"
        for item in partner.json()["items"]
        if "snapshot" in item
    )
    assert no_rows.status_code == 200
    assert no_rows.json()["items"] == []
    assert no_rows.json()["next_cursor"] == 9
    assert no_rows.json()["has_more"] is False


def test_sync_changes_empty_database_returns_zero_high_water(empty_sync_client):
    response = get_changes(empty_sync_client)

    assert response.status_code == 200
    assert response.json()["items"] == []
    assert response.json()["next_cursor"] == 0
    assert response.json()["has_more"] is False


def test_sync_changes_limit_plus_one_paging_and_limit_changes(sync_client):
    first = get_changes(sync_client, params={"limit": 2})
    second = get_changes(sync_client, params={"cursor": first.json()["next_cursor"], "limit": 1})
    third = get_changes(sync_client, params={"cursor": second.json()["next_cursor"], "limit": 500})

    assert first.status_code == 200
    assert [item["cursor"] for item in first.json()["items"]] == [1, 3]
    assert first.json()["next_cursor"] == 3
    assert first.json()["has_more"] is True
    assert second.status_code == 200
    assert [item["cursor"] for item in second.json()["items"]] == [5]
    assert second.json()["next_cursor"] == 5
    assert second.json()["has_more"] is True
    assert third.status_code == 200
    assert [item["cursor"] for item in third.json()["items"]] == [7, 9]
    assert third.json()["next_cursor"] == 9
    assert third.json()["has_more"] is False
    assert [item["cursor"] for item in first.json()["items"] + second.json()["items"] + third.json()["items"]] == [
        1,
        3,
        5,
        7,
        9,
    ]


def test_sync_changes_validation_auth_and_future_cursor(sync_client):
    invalid_queries = [
        {"cursor": -1},
        {"cursor": "not-an-int"},
        {"limit": 0},
        {"limit": 501},
        {"limit": "not-an-int"},
        {"cursor": 10},
    ]
    for params in invalid_queries:
        response = get_changes(sync_client, params=params)
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"

    missing_auth = sync_client.get("/api/v1/sync/changes")
    bad_token = sync_client.get(
        "/api/v1/sync/changes",
        headers={"Authorization": "Bearer wrong"},
    )
    assert missing_auth.status_code == 401
    assert missing_auth.json()["error"]["code"] == "unauthorized"
    assert bad_token.status_code == 401
    assert bad_token.json()["error"]["code"] == "unauthorized"


def test_sync_changes_captured_high_water_excludes_later_rows(sync_client, monkeypatch):
    monkeypatch.setattr(sync_service, "get_latest_cursor", lambda db: 5)

    first = get_changes(sync_client, params={"limit": 100})

    assert first.status_code == 200
    assert [item["cursor"] for item in first.json()["items"]] == [1, 3, 5]
    assert first.json()["next_cursor"] == 5
    assert first.json()["has_more"] is False

    monkeypatch.undo()
    later = get_changes(sync_client, params={"cursor": 5, "limit": 100})
    assert later.status_code == 200
    assert [item["cursor"] for item in later.json()["items"]] == [7, 9]
    assert later.json()["next_cursor"] == 9
    assert later.json()["has_more"] is False


@pytest.fixture()
def sync_client(tmp_path):
    yield from build_sync_client(tmp_path, with_changes=True)


@pytest.fixture()
def empty_sync_client(tmp_path):
    yield from build_sync_client(tmp_path, with_changes=False)


def build_sync_client(tmp_path, *, with_changes: bool):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner", "empty": "token-empty"}
    user_ids = {"me": uuid4(), "partner": uuid4(), "empty": uuid4()}
    entity_ids = {
        "todo_one": uuid4(),
        "todo_two": uuid4(),
        "category_one": uuid4(),
        "partner_todo": uuid4(),
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
                User(
                    id=user_ids["empty"],
                    alias="empty",
                    display_name="Empty",
                    bootstrap_token_hash=hasher.hash(tokens["empty"]),
                    timezone="Asia/Shanghai",
                ),
            ]
        )
        if with_changes:
            db.add_all(
                [
                    sync_change(
                        cursor=1,
                        user_id=user_ids["me"],
                        change_type="todo.created",
                        entity_type="todo",
                        entity_id=entity_ids["todo_one"],
                        entity_version=1,
                        payload={"snapshot": {"id": "todo-one", "title": "Original"}},
                    ),
                    sync_change(
                        cursor=2,
                        user_id=user_ids["partner"],
                        change_type="todo.created",
                        entity_type="todo",
                        entity_id=entity_ids["partner_todo"],
                        entity_version=1,
                        payload={"snapshot": {"id": "partner-todo", "owner": "partner"}},
                    ),
                    sync_change(
                        cursor=3,
                        user_id=user_ids["me"],
                        change_type="todo.updated",
                        entity_type="todo",
                        entity_id=entity_ids["todo_one"],
                        entity_version=2,
                        payload={"snapshot": {"id": "todo-one", "title": "Updated"}},
                    ),
                    sync_change(
                        cursor=4,
                        user_id=user_ids["partner"],
                        change_type="todo.updated",
                        entity_type="todo",
                        entity_id=entity_ids["partner_todo"],
                        entity_version=2,
                        payload={"snapshot": {"id": "partner-todo", "owner": "partner"}},
                    ),
                    sync_change(
                        cursor=5,
                        user_id=user_ids["me"],
                        change_type="todo.deleted",
                        entity_type="todo",
                        entity_id=entity_ids["todo_one"],
                        entity_version=3,
                        payload={"deleted": True, "deleted_at": "2026-07-21T09:00:00+08:00"},
                    ),
                    sync_change(
                        cursor=7,
                        user_id=user_ids["me"],
                        change_type="category.deleted",
                        entity_type="todo_category",
                        entity_id=entity_ids["category_one"],
                        entity_version=4,
                        payload={"deleted": True, "deleted_at": "2026-07-21T10:00:00+08:00"},
                    ),
                    sync_change(
                        cursor=8,
                        user_id=user_ids["partner"],
                        change_type="todo.reopened",
                        entity_type="todo",
                        entity_id=entity_ids["partner_todo"],
                        entity_version=3,
                        payload={"snapshot": {"id": "partner-todo", "owner": "partner"}},
                    ),
                    sync_change(
                        cursor=9,
                        user_id=user_ids["me"],
                        change_type="sync.refresh",
                        entity_type="system",
                        entity_id=None,
                        entity_version=None,
                        payload=None,
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
        test_client.entity_ids = entity_ids
        test_client.session_factory = TestingSessionLocal
        yield test_client


def sync_change(
    *,
    cursor,
    user_id,
    change_type,
    entity_type,
    entity_id,
    entity_version,
    payload,
):
    return SyncChange(
        cursor=cursor,
        user_id=user_id,
        change_type=change_type,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_version=entity_version,
        payload=payload,
    )
