import asyncio
from datetime import datetime
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.api.v1.todo_categories as category_api
import app.api.v1.sync as sync_api
import app.api.v1.todos as todo_api
from app.core.database import Base, get_db
from app.main import create_app
from app.models.todo import Todo
from app.models.todo_category import TodoCategory
from app.models.user import User
from app.services.sync_events import (
    format_sse_event,
    sync_available_payload,
    sync_event_broker,
)


def auth_headers(sse_client, alias: str = "me", idempotency_key: str | None = None):
    headers = {"Authorization": f"Bearer {sse_client.tokens[alias]}"}
    if idempotency_key is not None:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def test_sync_events_auth_and_invalid_device_id(sse_client):
    missing_auth = sse_client.get("/api/v1/sync/events")
    bad_device_id = sse_client.get(
        "/api/v1/sync/events",
        headers=auth_headers(sse_client),
        params={"device_id": "x" * 129},
    )

    assert missing_auth.status_code == 401
    assert missing_auth.json()["error"]["code"] == "unauthorized"
    assert bad_device_id.status_code == 400
    assert bad_device_id.json()["error"]["code"] == "validation_error"



@pytest.mark.anyio
async def test_sync_events_stream_headers_device_id_event_and_cleanup(sse_client):
    user = User(id=sse_client.user_ids["me"])
    response = sync_api.get_sync_events(current_user=user, device_id="pc-web")

    assert response.status_code == 200
    assert response.media_type == "text/event-stream"
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-accel-buffering"] == "no"
    assert sync_event_broker.subscriber_count(sse_client.user_ids["me"]) == 1

    sync_event_broker.publish(user_id=sse_client.user_ids["me"], latest_cursor=11)
    event = await asyncio.wait_for(anext(response.body_iterator), timeout=1)
    await response.body_iterator.aclose()

    assert "sync.available" in event
    assert '"latest_cursor":11' in event
    assert sync_event_broker.subscriber_count(sse_client.user_ids["me"]) == 0


def test_sync_available_event_payload_and_framing_exclude_domain_data():
    payload = sync_available_payload(42)
    event = format_sse_event(payload)

    assert set(payload.keys()) == {"type", "latest_cursor", "server_time"}
    assert payload["type"] == "sync.available"
    assert payload["latest_cursor"] == 42
    assert event.startswith("event: sync.available\n")
    assert "\ndata: " in event
    assert event.endswith("\n\n")
    assert "snapshot" not in event
    assert "deleted_at" not in event
    assert "entity_id" not in event
    assert "user_id" not in event
    assert "device_id" not in event


def test_sync_event_broker_isolates_users_coalesces_and_cleans_up(sse_client):
    me_one = sync_event_broker.subscribe(sse_client.user_ids["me"])
    me_two = sync_event_broker.subscribe(sse_client.user_ids["me"])
    partner = sync_event_broker.subscribe(sse_client.user_ids["partner"])

    sync_event_broker.publish(user_id=sse_client.user_ids["me"], latest_cursor=3)
    sync_event_broker.publish(user_id=sse_client.user_ids["partner"], latest_cursor=9)
    sync_event_broker.publish(user_id=sse_client.user_ids["me"], latest_cursor=5)
    sync_event_broker.publish(user_id=sse_client.user_ids["me"], latest_cursor=4)

    assert me_one.queue.get_nowait() == 5
    assert me_two.queue.get_nowait() == 5
    assert partner.queue.get_nowait() == 9
    assert me_one.queue.empty()
    assert me_two.queue.empty()
    assert partner.queue.empty()

    sync_event_broker.unsubscribe(me_one)
    assert sync_event_broker.subscriber_count(sse_client.user_ids["me"]) == 1
    sync_event_broker.unsubscribe(me_two)
    sync_event_broker.unsubscribe(partner)
    assert sync_event_broker.subscriber_count(sse_client.user_ids["me"]) == 0
    assert sync_event_broker.subscriber_count(sse_client.user_ids["partner"]) == 0


@pytest.mark.anyio
async def test_sync_event_subscription_keepalive_has_no_domain_payload(sse_client):
    subscription = sync_event_broker.subscribe(sse_client.user_ids["me"])
    try:
        events = subscription.events(keepalive_seconds=0.01)
        keepalive = await asyncio.wait_for(anext(events), timeout=1)
    finally:
        sync_event_broker.unsubscribe(subscription)

    assert keepalive == ": keepalive\n\n"


def test_all_current_writes_publish_once_after_successful_commit(sse_client, monkeypatch):
    publications = []

    def record_publication(*, user_id, latest_cursor):
        publications.append((user_id, latest_cursor))

    monkeypatch.setattr(category_api, "publish_sync_available", record_publication)
    monkeypatch.setattr(todo_api, "publish_sync_available", record_publication)

    create_category = sse_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(sse_client, idempotency_key=str(uuid4())),
        json={"name": "Temp"},
    )
    category_id = create_category.json()["data"]["id"]
    update_category = sse_client.patch(
        f"/api/v1/todo-categories/{category_id}",
        headers=auth_headers(sse_client, idempotency_key=str(uuid4())),
        json={"name": "Temp Updated"},
    )
    delete_category = sse_client.delete(
        f"/api/v1/todo-categories/{category_id}",
        headers=auth_headers(sse_client, idempotency_key=str(uuid4())),
    )
    create_todo = sse_client.post(
        "/api/v1/todos",
        headers=auth_headers(sse_client, idempotency_key=str(uuid4())),
        json={"title": "SSE Todo"},
    )
    todo_id = create_todo.json()["data"]["id"]
    update_todo = sse_client.patch(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(sse_client, idempotency_key=str(uuid4())),
        json={"title": "SSE Todo Updated"},
    )
    complete_todo = sse_client.post(
        f"/api/v1/todos/{todo_id}/complete",
        headers=auth_headers(sse_client, idempotency_key=str(uuid4())),
    )
    reopen_todo = sse_client.post(
        f"/api/v1/todos/{todo_id}/reopen",
        headers=auth_headers(sse_client, idempotency_key=str(uuid4())),
    )
    delete_todo = sse_client.delete(
        f"/api/v1/todos/{todo_id}",
        headers=auth_headers(sse_client, idempotency_key=str(uuid4())),
    )

    assert [response.status_code for response in [
        create_category,
        update_category,
        delete_category,
        create_todo,
        update_todo,
        complete_todo,
        reopen_todo,
        delete_todo,
    ]] == [201, 200, 200, 201, 200, 200, 200, 200]
    assert publications == [(sse_client.user_ids["me"], cursor) for cursor in range(1, 9)]


def test_replay_validation_failure_and_reads_do_not_publish(sse_client, monkeypatch):
    publications = []

    def record_publication(*, user_id, latest_cursor):
        publications.append((user_id, latest_cursor))

    monkeypatch.setattr(category_api, "publish_sync_available", record_publication)
    monkeypatch.setattr(todo_api, "publish_sync_available", record_publication)

    key = str(uuid4())
    headers = auth_headers(sse_client, idempotency_key=key)
    first = sse_client.post("/api/v1/todo-categories", headers=headers, json={"name": "Replay"})
    replay = sse_client.post("/api/v1/todo-categories", headers=headers, json={"name": "Replay"})
    duplicate = sse_client.post(
        "/api/v1/todo-categories",
        headers=auth_headers(sse_client, idempotency_key=str(uuid4())),
        json={"name": "Inbox"},
    )
    read_categories = sse_client.get("/api/v1/todo-categories", headers=auth_headers(sse_client))
    read_changes = sse_client.get("/api/v1/sync/changes", headers=auth_headers(sse_client))

    assert first.status_code == 201
    assert replay.status_code == 201
    assert replay.json() == first.json()
    assert duplicate.status_code == 400
    assert read_categories.status_code == 200
    assert read_changes.status_code == 200
    assert publications == [(sse_client.user_ids["me"], 1)]


@pytest.fixture()
def anyio_backend():
    return "asyncio"


@pytest.fixture()
def sse_client(tmp_path):
    sync_event_broker.clear()
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner"}
    user_ids = {"me": uuid4(), "partner": uuid4()}
    category_ids = {"me_inbox": uuid4(), "partner_inbox": uuid4()}
    todo_ids = {"committed": uuid4()}

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
            ]
        )
        db.add(
            Todo(
                id=todo_ids["committed"],
                user_id=user_ids["me"],
                category_id=category_ids["me_inbox"],
                title="Committed",
                status="pending",
                priority="medium",
                version=1,
                created_at=datetime(2026, 7, 21, 9, 0, 0),
                updated_at=datetime(2026, 7, 21, 9, 0, 0),
            )
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
    sync_event_broker.clear()
