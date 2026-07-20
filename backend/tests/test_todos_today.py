from datetime import date, datetime, timedelta, timezone
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

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

CN_TZ = timezone(timedelta(hours=8))


def fixed_uuid(value: int) -> UUID:
    return UUID(f"00000000-0000-0000-0000-{value:012d}")


def cn_dt(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 7, day, hour, minute, tzinfo=CN_TZ)


def ny_dt(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=ZoneInfo("America/New_York"))


def auth_headers(today_client, alias: str = "me"):
    return {"Authorization": f"Bearer {today_client.tokens[alias]}"}


def get_today(today_client, params=None, alias: str = "me"):
    return today_client.get(
        "/api/v1/todos/today",
        headers=auth_headers(today_client, alias=alias),
        params=params or {"date": "2026-07-20"},
    )


def section_titles(response, section: str):
    return [item["title"] for item in response.json()["data"]["sections"][section]]


def all_section_ids(response):
    sections = response.json()["data"]["sections"]
    return [
        item["id"]
        for section in ("overdue", "due", "planned", "inbox_recent")
        for item in sections[section]
    ]


def row_counts(today_client):
    with today_client.session_factory() as db:
        return {
            "todos": len(db.execute(select(Todo)).all()),
            "sync_changes": len(db.execute(select(SyncChange)).all()),
            "idempotency": len(db.execute(select(IdempotencyKey)).all()),
        }


def test_today_returns_expected_envelope_sections_summary_and_dtos(today_client):
    before = row_counts(today_client)

    response = get_today(today_client)

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"data", "server_time"}
    assert body["data"]["date"] == "2026-07-20"
    assert body["data"]["timezone"] == "Asia/Shanghai"
    assert set(body["data"]["sections"].keys()) == {
        "overdue",
        "due",
        "planned",
        "inbox_recent",
    }
    assert "items" not in body
    assert "next_cursor" not in body
    assert "reminders" not in body["data"]
    assert body["data"]["summary"] == {
        "pending_count": 13,
        "completed_count": 2,
        "overdue_count": 2,
    }
    assert section_titles(response, "overdue") == ["Overdue high", "Overdue planned overlap"]
    assert section_titles(response, "due") == [
        "Due at start",
        "Due noon older",
        "Due noon newer",
        "Due planned overlap",
    ]
    assert section_titles(response, "planned") == [
        "Planned deleted category",
        "Planned missing category",
    ]
    assert section_titles(response, "inbox_recent") == [
        "Inbox newest high",
        "Inbox newest medium",
        "Inbox selected low C",
        "Inbox selected low B",
        "Inbox selected low A",
    ]
    ids = all_section_ids(response)
    assert len(ids) == len(set(ids))
    assert "Inbox too old" not in section_titles(response, "inbox_recent")
    assert row_counts(today_client) == before

    by_title = {
        item["title"]: item
        for section in body["data"]["sections"].values()
        for item in section
    }
    assert by_title["Due at start"]["category"] == {
        "id": str(today_client.category_ids["inbox"]),
        "name": "Inbox",
        "is_deleted": False,
    }
    assert by_title["Planned deleted category"]["category"] == {
        "id": str(today_client.category_ids["deleted"]),
        "name": "Archived",
        "is_deleted": True,
    }
    assert by_title["Planned missing category"]["category_id"] == str(
        today_client.category_ids["missing"]
    )
    assert by_title["Planned missing category"]["category"] is None
    for item in by_title.values():
        assert "user_id" not in item
        assert "deleted_at" not in item
        assert "canceled_at" not in item
        assert "source_client_id" not in item
        assert "client_created_id" not in item


def test_today_auth_date_validation_and_static_route_precedence(today_client):
    missing_auth = today_client.get("/api/v1/todos/today", params={"date": "2026-07-20"})
    bad_token = today_client.get(
        "/api/v1/todos/today",
        headers={"Authorization": "Bearer wrong"},
        params={"date": "2026-07-20"},
    )
    missing_date = today_client.get("/api/v1/todos/today", headers=auth_headers(today_client))
    bad_date = get_today(today_client, params={"date": "not-a-date"})

    assert missing_auth.status_code == 401
    assert missing_auth.json()["error"]["code"] == "unauthorized"
    assert bad_token.status_code == 401
    assert bad_token.json()["error"]["code"] == "unauthorized"
    assert missing_date.status_code == 400
    assert missing_date.json()["error"]["code"] == "validation_error"
    assert bad_date.status_code == 400
    assert bad_date.json()["error"]["code"] == "validation_error"
    assert "uuid" not in bad_date.json()["error"]["message"].lower()


def test_today_timezone_boundaries_and_dst_date(today_client):
    china = get_today(today_client, params={"date": "2026-07-20"})
    new_york = get_today(today_client, params={"date": "2026-03-08"}, alias="ny")

    assert china.status_code == 200
    assert "Due end exclusive" not in section_titles(china, "due")
    assert "Due end exclusive" not in section_titles(china, "planned")
    assert china.json()["data"]["summary"]["completed_count"] == 2

    assert new_york.status_code == 200
    assert new_york.json()["data"]["timezone"] == "America/New_York"
    assert section_titles(new_york, "overdue") == ["NY overdue before DST day"]
    assert section_titles(new_york, "due") == ["NY due at DST midnight", "NY due inside DST day"]
    assert "NY due end exclusive" not in section_titles(new_york, "due")
    assert new_york.json()["data"]["summary"] == {
        "pending_count": 3,
        "completed_count": 1,
        "overdue_count": 1,
    }


def test_today_inbox_recent_uses_owned_active_inbox_and_excludes_other_rows(today_client):
    response = get_today(today_client)

    assert response.status_code == 200
    inbox_titles = section_titles(response, "inbox_recent")
    assert len(inbox_titles) == 5
    assert "Inbox too old" not in inbox_titles
    assert "Work no date" not in inbox_titles
    assert "Partner todo" not in inbox_titles
    assert "Deleted todo" not in inbox_titles
    assert "Completed inside one" not in inbox_titles
    assert "Canceled inside completion" not in inbox_titles


def test_today_batch_loads_categories_without_n_plus_one(today_client):
    category_queries = []

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if "FROM todo_categories" in statement:
            category_queries.append(statement)

    event.listen(today_client.engine, "before_cursor_execute", before_cursor_execute)
    try:
        response = get_today(today_client)
    finally:
        event.remove(today_client.engine, "before_cursor_execute", before_cursor_execute)

    assert response.status_code == 200
    assert len(category_queries) == 2


@pytest.fixture()
def today_client(tmp_path):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "token-me", "partner": "token-partner", "ny": "token-ny"}
    user_ids = {"me": uuid4(), "partner": uuid4(), "ny": uuid4()}
    category_ids = {
        "inbox": fixed_uuid(101),
        "work": fixed_uuid(102),
        "deleted": fixed_uuid(103),
        "missing": fixed_uuid(104),
        "partner": fixed_uuid(105),
        "ny_inbox": fixed_uuid(106),
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
                    id=user_ids["ny"],
                    alias="ny",
                    display_name="New York",
                    bootstrap_token_hash=hasher.hash(tokens["ny"]),
                    timezone="America/New_York",
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
                    name="Archived",
                    is_inbox=False,
                    sort_order=2,
                    deleted_at=cn_dt(18, 12),
                ),
                TodoCategory(
                    id=category_ids["partner"],
                    user_id=user_ids["partner"],
                    name="Partner Inbox",
                    is_inbox=True,
                    sort_order=0,
                ),
                TodoCategory(
                    id=category_ids["ny_inbox"],
                    user_id=user_ids["ny"],
                    name="NY Inbox",
                    is_inbox=True,
                    sort_order=0,
                ),
            ]
        )
        db.add_all(
            [
                pending_todo(1, user_ids["me"], category_ids["work"], "Overdue high", "high", due_at=cn_dt(19, 23)),
                pending_todo(
                    2,
                    user_ids["me"],
                    category_ids["work"],
                    "Overdue planned overlap",
                    "medium",
                    planned_date=date(2026, 7, 20),
                    due_at=cn_dt(19, 22),
                ),
                pending_todo(3, user_ids["me"], category_ids["inbox"], "Due at start", "high", due_at=cn_dt(20, 0)),
                pending_todo(4, user_ids["me"], category_ids["work"], "Due noon newer", "medium", due_at=cn_dt(20, 12), created_at=cn_dt(19, 12)),
                pending_todo(5, user_ids["me"], category_ids["work"], "Due noon older", "medium", due_at=cn_dt(20, 12), created_at=cn_dt(19, 11)),
                pending_todo(
                    6,
                    user_ids["me"],
                    category_ids["work"],
                    "Due planned overlap",
                    "low",
                    planned_date=date(2026, 7, 20),
                    due_at=cn_dt(20, 13),
                ),
                pending_todo(7, user_ids["me"], category_ids["work"], "Due end exclusive", "high", due_at=cn_dt(21, 0)),
                pending_todo(8, user_ids["me"], category_ids["deleted"], "Planned deleted category", "high", planned_date=date(2026, 7, 20)),
                pending_todo(9, user_ids["me"], category_ids["missing"], "Planned missing category", "medium", planned_date=date(2026, 7, 20)),
                pending_todo(10, user_ids["me"], category_ids["inbox"], "Inbox too old", "high", created_at=cn_dt(20, 7)),
                pending_todo(11, user_ids["me"], category_ids["inbox"], "Inbox selected low C", "low", created_at=cn_dt(20, 8)),
                pending_todo(12, user_ids["me"], category_ids["inbox"], "Inbox selected low B", "low", created_at=cn_dt(20, 9)),
                pending_todo(13, user_ids["me"], category_ids["inbox"], "Inbox selected low A", "low", created_at=cn_dt(20, 10)),
                pending_todo(14, user_ids["me"], category_ids["inbox"], "Inbox newest medium", "medium", created_at=cn_dt(20, 11)),
                pending_todo(15, user_ids["me"], category_ids["inbox"], "Inbox newest high", "high", created_at=cn_dt(20, 12)),
                pending_todo(16, user_ids["me"], category_ids["work"], "Work no date", "high", created_at=cn_dt(20, 13)),
                status_todo(17, user_ids["me"], category_ids["work"], "Completed inside one", "completed", completed_at=cn_dt(20, 0)),
                status_todo(18, user_ids["me"], category_ids["work"], "Completed inside two", "completed", completed_at=cn_dt(20, 23, 59)),
                status_todo(19, user_ids["me"], category_ids["work"], "Completed end exclusive", "completed", completed_at=cn_dt(21, 0)),
                status_todo(20, user_ids["me"], category_ids["work"], "Canceled inside completion", "canceled", completed_at=cn_dt(20, 10)),
                status_todo(
                    21,
                    user_ids["me"],
                    category_ids["work"],
                    "Deleted todo",
                    "pending",
                    due_at=cn_dt(20, 10),
                    deleted_at=cn_dt(20, 11),
                ),
                pending_todo(22, user_ids["partner"], category_ids["partner"], "Partner todo", "high", due_at=cn_dt(20, 10)),
                status_todo(23, user_ids["partner"], category_ids["partner"], "Partner completed", "completed", completed_at=cn_dt(20, 10)),
                pending_todo(24, user_ids["ny"], category_ids["ny_inbox"], "NY overdue before DST day", "high", due_at=ny_dt(2026, 3, 7, 23, 30)),
                pending_todo(25, user_ids["ny"], category_ids["ny_inbox"], "NY due at DST midnight", "high", due_at=ny_dt(2026, 3, 8, 0, 0)),
                pending_todo(26, user_ids["ny"], category_ids["ny_inbox"], "NY due inside DST day", "medium", due_at=ny_dt(2026, 3, 8, 3, 30)),
                pending_todo(27, user_ids["ny"], category_ids["ny_inbox"], "NY due end exclusive", "high", due_at=ny_dt(2026, 3, 9, 0, 0)),
                status_todo(28, user_ids["ny"], category_ids["ny_inbox"], "NY completed inside", "completed", completed_at=ny_dt(2026, 3, 8, 23, 30)),
                status_todo(29, user_ids["ny"], category_ids["ny_inbox"], "NY completed end exclusive", "completed", completed_at=ny_dt(2026, 3, 9, 0, 0)),
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
        test_client.engine = engine
        yield test_client


def pending_todo(
    index,
    user_id,
    category_id,
    title,
    priority,
    *,
    planned_date=None,
    due_at=None,
    created_at=None,
):
    created = created_at or cn_dt(20, 6)
    return Todo(
        id=fixed_uuid(index),
        user_id=user_id,
        category_id=category_id,
        title=title,
        status="pending",
        priority=priority,
        planned_date=planned_date,
        due_at=due_at,
        created_at=created,
        updated_at=created,
        version=1,
    )


def status_todo(
    index,
    user_id,
    category_id,
    title,
    status,
    *,
    due_at=None,
    completed_at=None,
    deleted_at=None,
):
    return Todo(
        id=fixed_uuid(index),
        user_id=user_id,
        category_id=category_id,
        title=title,
        status=status,
        priority="medium",
        due_at=due_at,
        completed_at=completed_at,
        created_at=cn_dt(20, 6),
        updated_at=cn_dt(20, 6),
        deleted_at=deleted_at,
        version=1,
    )
