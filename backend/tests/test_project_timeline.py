import base64
import json
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from sqlalchemy import event, select

from app.models.ai_session import AISession
from app.models.project_log import ProjectLog
from app.models.project_todo_link import ProjectTodoLink
from app.models.todo import Todo
from app.models.user import User
from app.schemas.ai_session import as_utc
from test_project_stages import client, create_project, headers
from test_project_logs import log_path, parent, write


def timeline(client, project, **params):
    return client.get(f"/api/v1/projects/{project['id']}/timeline", headers=headers(), params=params)


def seed_sources(client, project, count=3):
    time = datetime(2026, 10, 15, 2, 0, 0, 123456, timezone.utc)
    with client.factory() as db:
        owner = db.execute(select(User.id).where(User.alias == "me")).scalar_one()
        for index in range(count):
            id = UUID(int=index + 1)
            db.add(ProjectLog(id=id, user_id=owner, project_id=project["id"], title=f"Log {index}", content="  " + "😀" * 301 + "  ", created_at=time))
            db.add(AISession(id=id, user_id=owner, project_id=project["id"], goal=f"Session {index}", completed_work="  summary  ", started_at=time))
            # Existing Todo complete API stores Shanghai wall time in SQLite.
            db.add(Todo(id=id, user_id=owner, title=f"Todo {index}", status="completed", completed_at=time.astimezone(timezone(timedelta(hours=8)))))
        db.flush()
        for index in range(count):
            db.add(ProjectTodoLink(user_id=owner, project_id=project["id"], todo_id=UUID(int=index + 1), sort_order=index, created_at=time - timedelta(seconds=1)))
        db.commit()
    return time


def test_complete_tie_tuple_keysets_and_bounded_reads(client):
    project = create_project(client)
    time = seed_sources(client, project, 24)
    old = parent(client, project)
    queries, statements = [], []
    engine = client.factory.kw["bind"]

    def capture(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)
        if any(f"FROM {name}" in statement for name in ("project_logs", "ai_sessions", "todos")):
            queries.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        items, cursor = [], None
        while True:
            data = timeline(client, project, limit=7 if cursor is None else 11, **({"cursor": cursor} if cursor else {})).json()
            items.extend(data["items"])
            cursor = data["next_cursor"]
            if cursor is None:
                break
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    expected = [(kind, str(UUID(int=index + 1))) for kind in ("manual_log", "ai_session", "todo_completed") for index in range(24)]
    assert [(row["kind"], row["source_id"]) for row in items] == expected
    assert len(queries) == 21 and all("LIMIT" in query for query in queries)
    assert all(not query.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")) for query in statements)
    assert all(set(row) == {"kind", "source_id", "occurred_at", "title", "summary", "source_version"} for row in items)
    assert all(as_utc(datetime.fromisoformat(row["occurred_at"])) == time for row in items)
    assert items[0]["summary"] == "😀" * 300
    assert items[24]["summary"] == "summary" and items[-1]["summary"] is None
    assert parent(client, project) == old


def test_source_filtering_live_edits_and_no_read_writes(client):
    project = create_project(client)
    time = seed_sources(client, project)
    old = parent(client, project)
    with client.factory() as db:
        db.get(ProjectLog, UUID(int=1)).deleted_at = time
        db.get(ProjectLog, UUID(int=2)).title = "edited"
        db.get(ProjectLog, UUID(int=2)).version = 2
        db.get(AISession, UUID(int=1)).started_at = time + timedelta(seconds=1)
        db.get(Todo, UUID(int=1)).status = "pending"
        db.get(Todo, UUID(int=2)).completed_at = (time - timedelta(seconds=2)).astimezone(timezone(timedelta(hours=8)))
        db.get(Todo, UUID(int=3)).deleted_at = time
        db.commit()
    data = timeline(client, project).json()["items"]
    assert len(data) == 5 and data[0]["kind"] == "ai_session"
    log = next(row for row in data if row["title"] == "edited")
    assert log["source_version"] == 2 and as_utc(datetime.fromisoformat(log["occurred_at"])) == time
    with client.factory() as db:
        todo = db.get(Todo, UUID(int=1))
        todo.status = "completed"
        todo.completed_at = (time + timedelta(seconds=3)).astimezone(timezone(timedelta(hours=8)))
        db.commit()
    assert timeline(client, project).json()["items"][0]["kind"] == "todo_completed"
    with client.factory() as db:
        db.delete(db.get(ProjectTodoLink, (UUID(project["id"]), UUID(int=1))))
        partner = db.execute(select(User.id).where(User.alias == "partner")).scalar_one()
        db.get(AISession, UUID(int=2)).user_id = partner
        db.get(ProjectLog, UUID(int=3)).user_id = partner
        db.commit()
    assert len(timeline(client, project).json()["items"]) == 3
    assert parent(client, project) == old


def raw_cursor(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip("=")


def test_cursor_validation_binding_and_limits(client):
    project, other = create_project(client), create_project(client)
    seed_sources(client, project)
    cursor = timeline(client, project, limit=1).json()["next_cursor"]
    valid = json.loads(base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)))
    invalid = ["", "not-json", "!", "a" * 4097, raw_cursor([]), base64.urlsafe_b64encode(("[" * 1500 + "0" + "]" * 1500).encode()).decode().rstrip("=")]
    for field, value in (("v", True), ("v", 2), ("owner_id", []), ("project_id", str(uuid4())), ("extra", 1)):
        invalid.append(raw_cursor({**valid, field: value}))
    for field, value in (("kind", []), ("kind", "milestone"), ("source_id", None), ("source_id", "bad"), ("occurred_at", "2026-10-15T00:00:00"), ("occurred_at", "0001-01-01T00:00:00+08:00"), ("occurred_at", "invalid"), ("extra", 1)):
        invalid.append(raw_cursor({**valid, "anchor": {**valid["anchor"], field: value}}))
    for cursor in invalid:
        response = timeline(client, project, cursor=cursor)
        assert response.status_code == 400, response.text
        assert response.json()["error"]["code"] == "validation_error"
    assert timeline(client, other, cursor=raw_cursor(valid)).status_code == 400
    for limit in (0, 101, "bad"):
        assert timeline(client, project, limit=limit).status_code == 400
    route = f"/api/v1/projects/{project['id']}/timeline"
    assert client.get(route).status_code == 401
    assert client.get(route, headers=headers("partner")).status_code == 404
    assert timeline(client, {"id": str(uuid4())}).status_code == 404
    assert timeline(client, other).json()["items"] == []


def test_actual_todo_completion_timestamp_matches_link_boundary(client):
    project = create_project(client)
    with client.factory() as db:
        owner = db.execute(select(User.id).where(User.alias == "me")).scalar_one()
        id = uuid4()
        db.add(Todo(id=id, user_id=owner, title="actual source"))
        db.commit()
    assert write(client, "PUT", f"/api/v1/projects/{project['id']}/todo-links", {"todo_ids": [str(id)]}).status_code == 200
    completed = write(client, "POST", f"/api/v1/todos/{id}/complete")
    assert completed.status_code == 200
    projected = timeline(client, project).json()["items"][0]
    assert projected["source_id"] == str(id)
    actual = datetime.fromisoformat(completed.json()["data"]["completed_at"])
    assert datetime.fromisoformat(projected["occurred_at"]) == actual


def test_microsecond_order_is_exact_without_float_timestamp_rounding(client):
    project = create_project(client)
    with client.factory() as db:
        owner = db.execute(select(User.id).where(User.alias == "me")).scalar_one()
        for index in (1, 2):
            db.add(AISession(id=UUID(int=index), user_id=owner, project_id=project["id"], goal=str(index), started_at=datetime(9998, 1, 1, 0, 0, 0, index, timezone.utc)))
        db.commit()
    first = timeline(client, project, limit=1).json()
    second = timeline(client, project, limit=1, cursor=first["next_cursor"]).json()
    assert [first["items"][0]["title"], second["items"][0]["title"]] == ["2", "1"]


def test_all_ineligible_todo_states_and_foreign_source_are_excluded(client):
    project = create_project(client)
    time = seed_sources(client, project, 6)
    with client.factory() as db:
        partner = db.execute(select(User.id).where(User.alias == "partner")).scalar_one()
        db.get(Todo, UUID(int=1)).completed_at = None
        db.get(Todo, UUID(int=2)).status = "canceled"
        db.get(Todo, UUID(int=3)).status = "pending"
        db.get(Todo, UUID(int=4)).user_id = partner
        db.get(Todo, UUID(int=5)).deleted_at = time
        db.get(Todo, UUID(int=6)).completed_at = (time - timedelta(seconds=2)).astimezone(timezone(timedelta(hours=8)))
        db.commit()
    items = timeline(client, project).json()["items"]
    assert len(items) == 12 and not any(row["kind"] == "todo_completed" for row in items)
