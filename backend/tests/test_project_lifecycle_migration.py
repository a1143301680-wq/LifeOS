from concurrent.futures import ThreadPoolExecutor
from threading import Event
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.database import get_db
from app.main import create_app
from app.models.ai_session import AISession
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.project_log import ProjectLog
from app.models.project_stage import ProjectStage
from app.models.project_todo_link import ProjectTodoLink
from app.models.todo import Todo
from app.models.user import User
from app.services.sync import create_sync_change
from test_project_log_migration import legacy
from test_project_stage_migration import alembic, disposable_postgres


def snapshot(engine):
    data = legacy(engine)
    with engine.connect() as connection:
        data["project_logs"] = list(connection.execute(text("SELECT * FROM project_logs ORDER BY id")).mappings())
    return data


def test_postgres_lifecycle_preserves_rows_and_serializes_child_mutations(disposable_postgres):
    url = disposable_postgres
    alembic(url, "upgrade", "20261015_0010")
    engine = create_engine(url)
    factory = sessionmaker(bind=engine, autoflush=False)
    owner, project, other, todo = (uuid4() for _ in range(4))
    with factory.begin() as db:
        db.add(User(id=owner, alias="lifecycle", display_name="Owner", timezone="UTC",
                    bootstrap_token_hash=PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1).hash("synthetic-lifecycle")))
        db.flush()
        for ident in (project, other):
            db.execute(Project.__table__.insert().values(id=ident, user_id=owner, name="Legacy", is_pinned=True, version=7))
        db.add(Todo(id=todo, user_id=owner, title="Shared Todo"))
        db.flush()
        db.add_all([ProjectTodoLink(project_id=ident, user_id=owner, todo_id=todo, sort_order=0) for ident in (project, other)])
        db.add(ProjectStage(project_id=project, user_id=owner, name="Stage", sort_order=0))
        db.add(Milestone(project_id=project, user_id=owner, title="Target", sort_order=0))
        db.add(AISession(project_id=project, user_id=owner, goal="Existing"))
        db.add(ProjectLog(project_id=project, user_id=owner, title="Existing"))
        create_sync_change(db, user_id=owner, change_type="todo.created", entity_type="todo", entity_id=todo, entity_version=1, payload={})
    before = snapshot(engine)
    alembic(url, "upgrade", "head")
    assert snapshot(engine) == before
    with engine.connect() as connection:
        assert connection.execute(text("SELECT archived_at, deleted_at FROM projects")).all() == [(None, None)] * 2
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("UPDATE projects SET deleted_at = now() WHERE id = :id"), {"id": project})

    app = create_app()

    def session():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = session

    def request(method, path, payload=None, key=None):
        with TestClient(app) as client:
            options = {"json": payload} if payload is not None else {}
            return client.request(method, "/api/v1/projects" + path,
                                  headers={"Authorization": "Bearer synthetic-lifecycle", "Idempotency-Key": str(key or uuid4())},
                                  **options)

    route = f"/{project}"
    assert request("POST", route + "/archive").status_code == 200
    preserved = snapshot(engine)
    assert request("DELETE", route).status_code == 200
    after = snapshot(engine)
    assert {k: v for k, v in after.items() if k != "projects"} == {k: v for k, v in preserved.items() if k != "projects"}
    assert request("GET", f"/{other}/todo-links").json()["data"]["links"][0]["todo"]["id"] == str(todo)
    assert request("GET", route).status_code == 404
    alembic(url, "upgrade", "head")
    assert request("GET", route).status_code == 404
    alembic(url, "downgrade", "20261015_0010")
    assert snapshot(engine) == after
    with engine.connect() as connection:
        columns = connection.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'projects'")).scalars().all()
        assert "archived_at" not in columns and "deleted_at" not in columns
        assert connection.execute(text("SELECT id FROM projects")).scalars().all()
    alembic(url, "upgrade", "head")
    assert snapshot(engine) == after
    assert request("GET", route).json()["data"]["archived_at"] is None
    assert len(request("GET", "").json()["items"]) == 2

    writes = (
        ("PATCH", "", {"name": "Edited"}, 200, 1),
        ("PUT", "/stages", {"stages": [], "current_stage_id": None}, 200, 1),
        ("PUT", "/milestones", {"milestones": [{"id": str(uuid4()), "title": "New target", "target_date": None, "status": "pending"}]}, 200, 1),
        ("PUT", "/todo-links", {"todo_ids": [str(todo)]}, 200, 1),
        ("POST", "/logs", {"title": "New log"}, 201, 1),
        ("POST", "/ai-sessions", {"goal": "New session"}, 201, 0),
        ("PATCH", "/ai-sessions/{session}", {"goal": "Edited session"}, 200, 0),
    )
    for method, suffix, payload, status, bump in writes:
        for deletion_first in (False, True):
            created = request("POST", "", {"name": "Race fixture"}).json()["data"]
            route = "/" + created["id"]
            sid = request("POST", route + "/ai-sessions", {"goal": "Initial"}).json()["data"]["id"]
            assert request("POST", route + "/archive").status_code == 200
            locked, waiting, release = Event(), Event(), Event()

            def before_sql(conn, cursor, statement, parameters, context, many):
                if locked.is_set() and "FOR UPDATE" in statement and "FROM projects" in statement:
                    waiting.set()

            def after_sql(conn, cursor, statement, parameters, context, many):
                if "FOR UPDATE" in statement and "FROM projects" in statement and not locked.is_set():
                    locked.set()
                    assert release.wait(10)

            write_path = route + suffix.format(session=sid)
            calls = [("DELETE", route, None), (method, write_path, payload)]
            order = calls if deletion_first else calls[::-1]
            event.listen(engine, "before_cursor_execute", before_sql)
            event.listen(engine, "after_cursor_execute", after_sql)
            try:
                with ThreadPoolExecutor(max_workers=2) as pool:
                    first = pool.submit(request, *order[0])
                    try:
                        assert locked.wait(10)
                        second = pool.submit(request, *order[1])
                        assert waiting.wait(10)
                    finally:
                        release.set()
                    a, b = first.result(20), second.result(20)
            finally:
                event.remove(engine, "before_cursor_execute", before_sql)
                event.remove(engine, "after_cursor_execute", after_sql)
            assert (a.status_code, b.status_code) == ((200, 404) if deletion_first else (status, 200)), (a.text, b.text)
            deleted = a if deletion_first else b
            assert deleted.json()["data"]["version"] == 3 + (0 if deletion_first else bump)
            assert request("GET", route).status_code == 404
            with factory() as db:
                row = db.get(AISession, sid)
                if method == "PATCH" and suffix.startswith("/ai-sessions"):
                    assert row.goal == ("Initial" if deletion_first else "Edited session")
                    assert row.version == (1 if deletion_first else 2)
    final = snapshot(engine)
    for key in ("todos", "todo_categories", "sync_changes", "cursor_sequence"):
        assert final[key] == before[key]
    engine.dispose()
