import base64
import json
from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import create_app
from app.models.idempotency import IdempotencyKey
from app.models.sync import SyncChange
from app.models.todo import Todo
from app.models.todo_category import TodoCategory
from app.models.user import User

TZ = timezone(timedelta(hours=8))


def dt(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 7, 17, hour, minute, tzinfo=TZ)


def fixed_uuid(value: int) -> UUID:
    return UUID(f"00000000-0000-0000-0000-{value:012d}")


def auth_headers(todo_list_client, alias: str = "me"):
    return {"Authorization": f"Bearer {todo_list_client.tokens[alias]}"}


def row_counts(todo_list_client):
    with todo_list_client.session_factory() as db:
        return {
            "todos": len(db.execute(select(Todo)).all()),
            "sync_changes": len(db.execute(select(SyncChange)).all()),
            "idempotency": len(db.execute(select(IdempotencyKey)).all()),
        }


def list_todos(todo_list_client, params=None, alias: str = "me"):
    return todo_list_client.get(
        "/api/v1/todos",
        headers=auth_headers(todo_list_client, alias=alias),
        params=params or {},
    )


def titles(response):
    return [item["title"] for item in response.json()["items"]]


def encode_cursor_payload(payload: object) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_cursor(raw_cursor: str) -> dict:
    padded = raw_cursor + "=" * (-len(raw_cursor) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))


def test_list_todos_default_visibility_dto_categories_and_no_side_effects(todo_list_client):
    before = row_counts(todo_list_client)

    response = list_todos(todo_list_client, params={"limit": 100})

    assert response.status_code == 200
    body = response.json()
    assert body["next_cursor"] is None
    assert "sync" not in body
    assert titles(response) == [
        "Planned earlier",
        "Due early high",
        "Due early medium newer",
        "Due early medium older",
        "Due later",
        "Planned no due",
        "Deleted category todo",
        "Missing category todo",
        "No category todo",
    ]
    assert all(item["status"] == "pending" for item in body["items"])
    assert "Deleted todo" not in titles(response)
    assert "Partner todo" not in titles(response)
    assert "Completed todo" not in titles(response)
    assert "Canceled todo" not in titles(response)

    by_title = {item["title"]: item for item in body["items"]}
    assert by_title["Due early high"]["category"] == {
        "id": str(todo_list_client.category_ids["active"]),
        "name": "Work",
        "is_deleted": False,
    }
    assert by_title["Deleted category todo"]["category"] == {
        "id": str(todo_list_client.category_ids["deleted"]),
        "name": "Archived",
        "is_deleted": True,
    }
    assert by_title["Missing category todo"]["category_id"] == str(
        todo_list_client.category_ids["missing"]
    )
    assert by_title["Missing category todo"]["category"] is None
    assert by_title["No category todo"]["category_id"] is None
    assert by_title["No category todo"]["category"] is None
    for item in body["items"]:
        assert "user_id" not in item
        assert "deleted_at" not in item
        assert "canceled_at" not in item
        assert "source_client_id" not in item
        assert "client_created_id" not in item

    assert row_counts(todo_list_client) == before


def test_list_todos_status_and_filters(todo_list_client):
    completed = list_todos(todo_list_client, params={"status": "completed"})
    all_statuses = list_todos(todo_list_client, params={"status": "all", "limit": 100})
    active_category = list_todos(
        todo_list_client,
        params={"category_id": str(todo_list_client.category_ids["active"]), "limit": 100},
    )
    cross_user_category = list_todos(
        todo_list_client,
        params={"category_id": str(todo_list_client.category_ids["partner"]), "limit": 100},
    )
    planned = list_todos(todo_list_client, params={"planned_date": "2026-07-17", "limit": 100})
    due_range = list_todos(
        todo_list_client,
        params={
            "due_from": "2026-07-17T09:00:00+08:00",
            "due_to": "2026-07-17T09:00:00+08:00",
            "limit": 100,
        },
    )
    combined = list_todos(
        todo_list_client,
        params={
            "status": "all",
            "category_id": str(todo_list_client.category_ids["active"]),
            "planned_date": "2026-07-15",
            "limit": 100,
        },
    )

    assert completed.status_code == 200
    assert titles(completed) == ["Completed todo"]
    assert all_statuses.status_code == 200
    assert {"Completed todo", "Canceled todo"}.issubset(set(titles(all_statuses)))
    assert "Deleted todo" not in titles(all_statuses)
    assert "Partner todo" not in titles(all_statuses)
    assert active_category.status_code == 200
    assert all(
        item["category_id"] == str(todo_list_client.category_ids["active"])
        for item in active_category.json()["items"]
    )
    assert cross_user_category.status_code == 200
    assert cross_user_category.json()["items"] == []
    assert planned.status_code == 200
    assert titles(planned) == [
        "Due early high",
        "Due early medium newer",
        "Due early medium older",
        "Due later",
        "Planned no due",
    ]
    assert due_range.status_code == 200
    assert titles(due_range) == [
        "Due early high",
        "Due early medium newer",
        "Due early medium older",
    ]
    assert combined.status_code == 200
    assert titles(combined) == ["Completed todo", "Canceled todo"]


def test_list_todos_cursor_pagination_schema_and_limit_change(todo_list_client):
    first = list_todos(todo_list_client, params={"limit": 3})

    assert first.status_code == 200
    first_body = first.json()
    assert titles(first) == ["Planned earlier", "Due early high", "Due early medium newer"]
    assert first_body["next_cursor"] is not None
    assert "=" not in first_body["next_cursor"]
    decoded = decode_cursor(first_body["next_cursor"])
    assert decoded["v"] == 1
    assert decoded["filters"] == {
        "status": "pending",
        "category_id": None,
        "planned_date": None,
        "due_from": None,
        "due_to": None,
        "sort": "todo-list-v1",
    }
    assert decoded["anchor"]["id"] == str(todo_list_client.todo_ids["due_medium_newer"])
    assert decoded["anchor"]["priority_rank"] == 2

    second = list_todos(todo_list_client, params={"cursor": first_body["next_cursor"], "limit": 4})
    assert second.status_code == 200
    assert titles(second) == [
        "Due early medium older",
        "Due later",
        "Planned no due",
        "Deleted category todo",
    ]

    seen = titles(first) + titles(second)
    cursor = second.json()["next_cursor"]
    while cursor is not None:
        page = list_todos(todo_list_client, params={"cursor": cursor, "limit": 2})
        assert page.status_code == 200
        seen.extend(titles(page))
        cursor = page.json()["next_cursor"]

    assert seen == [
        "Planned earlier",
        "Due early high",
        "Due early medium newer",
        "Due early medium older",
        "Due later",
        "Planned no due",
        "Deleted category todo",
        "Missing category todo",
        "No category todo",
    ]
    assert len(seen) == len(set(seen))


def test_list_todos_rejects_invalid_query_and_cursor_values(todo_list_client):
    invalid_queries = [
        {"status": "canceled"},
        {"category_id": "not-a-uuid"},
        {"planned_date": "2026-99-99"},
        {"due_from": "2026-07-17T09:00:00"},
        {"due_to": "2026-07-17T09:00:00"},
        {"due_from": "2026-07-17T10:00:00+08:00", "due_to": "2026-07-17T09:00:00+08:00"},
        {"limit": 0},
        {"limit": 101},
    ]
    for params in invalid_queries:
        response = list_todos(todo_list_client, params=params)
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"

    first = list_todos(todo_list_client, params={"limit": 2})
    valid_cursor = first.json()["next_cursor"]
    valid_payload = decode_cursor(valid_cursor)
    invalid_payloads = [
        "not-base64%",
        encode_cursor_payload(["not-an-object"]),
        encode_cursor_payload({**valid_payload, "v": 2}),
        encode_cursor_payload({"v": 1, "filters": valid_payload["filters"]}),
        encode_cursor_payload({**valid_payload, "extra": True}),
        encode_cursor_payload(
            {
                **valid_payload,
                "anchor": {**valid_payload["anchor"], "priority_rank": 9},
            }
        ),
        encode_cursor_payload(
            {
                **valid_payload,
                "anchor": {**valid_payload["anchor"], "id": "not-a-uuid"},
            }
        ),
        encode_cursor_payload(
            {
                **valid_payload,
                "anchor": {**valid_payload["anchor"], "planned_date": "bad-date"},
            }
        ),
    ]
    for cursor in invalid_payloads:
        response = list_todos(todo_list_client, params={"cursor": cursor})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"

    mismatch = list_todos(todo_list_client, params={"status": "completed", "cursor": valid_cursor})
    assert mismatch.status_code == 400
    assert mismatch.json()["error"]["code"] == "validation_error"


def test_list_todos_auth_and_category_batch_loading(todo_list_client):
    category_queries = []

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if "FROM todo_categories" in statement:
            category_queries.append(statement)

    event.listen(todo_list_client.engine, "before_cursor_execute", before_cursor_execute)
    try:
        response = list_todos(todo_list_client, params={"limit": 100})
    finally:
        event.remove(todo_list_client.engine, "before_cursor_execute", before_cursor_execute)

    missing_auth = todo_list_client.get("/api/v1/todos")
    bad_token = todo_list_client.get("/api/v1/todos", headers={"Authorization": "Bearer wrong"})

    assert response.status_code == 200
    assert len(category_queries) == 1
    assert missing_auth.status_code == 401
    assert missing_auth.json()["error"]["code"] == "unauthorized"
    assert bad_token.status_code == 401
    assert bad_token.json()["error"]["code"] == "unauthorized"


@pytest.fixture()
def todo_list_client(tmp_path):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner"}
    user_ids = {"me": uuid4(), "partner": uuid4()}
    category_ids = {
        "active": fixed_uuid(101),
        "deleted": fixed_uuid(102),
        "missing": fixed_uuid(103),
        "partner": fixed_uuid(104),
    }
    todo_ids = {
        "planned_earlier": fixed_uuid(1),
        "due_high": fixed_uuid(2),
        "due_medium_newer": fixed_uuid(3),
        "due_medium_older": fixed_uuid(4),
        "due_later": fixed_uuid(5),
        "planned_no_due": fixed_uuid(6),
        "deleted_category": fixed_uuid(7),
        "missing_category": fixed_uuid(8),
        "null_category": fixed_uuid(9),
        "completed": fixed_uuid(10),
        "canceled": fixed_uuid(11),
        "deleted_todo": fixed_uuid(12),
        "partner": fixed_uuid(13),
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
                    deleted_at=dt(18),
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
                    id=todo_ids["planned_earlier"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Planned earlier",
                    status="pending",
                    priority="low",
                    planned_date=date(2026, 7, 16),
                    updated_at=dt(10),
                    version=1,
                ),
                Todo(
                    id=todo_ids["due_high"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Due early high",
                    status="pending",
                    priority="high",
                    planned_date=date(2026, 7, 17),
                    due_at=dt(9),
                    updated_at=dt(10),
                    version=1,
                ),
                Todo(
                    id=todo_ids["due_medium_newer"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Due early medium newer",
                    status="pending",
                    priority="medium",
                    planned_date=date(2026, 7, 17),
                    due_at=dt(9),
                    updated_at=dt(12),
                    version=1,
                ),
                Todo(
                    id=todo_ids["due_medium_older"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Due early medium older",
                    status="pending",
                    priority="medium",
                    planned_date=date(2026, 7, 17),
                    due_at=dt(9),
                    updated_at=dt(11),
                    version=1,
                ),
                Todo(
                    id=todo_ids["due_later"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Due later",
                    status="pending",
                    priority="high",
                    planned_date=date(2026, 7, 17),
                    due_at=dt(10),
                    updated_at=dt(10),
                    version=1,
                ),
                Todo(
                    id=todo_ids["planned_no_due"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Planned no due",
                    status="pending",
                    priority="high",
                    planned_date=date(2026, 7, 17),
                    updated_at=dt(13),
                    version=1,
                ),
                Todo(
                    id=todo_ids["deleted_category"],
                    user_id=user_ids["me"],
                    category_id=category_ids["deleted"],
                    title="Deleted category todo",
                    status="pending",
                    priority="medium",
                    planned_date=date(2026, 7, 18),
                    updated_at=dt(14),
                    version=1,
                ),
                Todo(
                    id=todo_ids["missing_category"],
                    user_id=user_ids["me"],
                    category_id=category_ids["missing"],
                    title="Missing category todo",
                    status="pending",
                    priority="medium",
                    planned_date=date(2026, 7, 19),
                    updated_at=dt(15),
                    version=1,
                ),
                Todo(
                    id=todo_ids["null_category"],
                    user_id=user_ids["me"],
                    category_id=None,
                    title="No category todo",
                    status="pending",
                    priority="high",
                    due_at=dt(8),
                    updated_at=dt(16),
                    version=1,
                ),
                Todo(
                    id=todo_ids["completed"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Completed todo",
                    status="completed",
                    priority="medium",
                    planned_date=date(2026, 7, 15),
                    completed_at=dt(17),
                    updated_at=dt(17),
                    version=2,
                ),
                Todo(
                    id=todo_ids["canceled"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Canceled todo",
                    status="canceled",
                    priority="low",
                    planned_date=date(2026, 7, 15),
                    canceled_at=dt(18),
                    updated_at=dt(18),
                    version=2,
                ),
                Todo(
                    id=todo_ids["deleted_todo"],
                    user_id=user_ids["me"],
                    category_id=category_ids["active"],
                    title="Deleted todo",
                    status="pending",
                    priority="medium",
                    planned_date=date(2026, 7, 15),
                    updated_at=dt(19),
                    deleted_at=dt(19),
                    version=3,
                ),
                Todo(
                    id=todo_ids["partner"],
                    user_id=user_ids["partner"],
                    category_id=category_ids["partner"],
                    title="Partner todo",
                    status="pending",
                    priority="high",
                    planned_date=date(2026, 7, 14),
                    updated_at=dt(20),
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
        test_client.engine = engine
        yield test_client
