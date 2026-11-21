from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.database import get_db
from app.models.ai_session import AISession
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.project_stage import ProjectStage
from app.models.project_todo_link import ProjectTodoLink
from app.models.todo import Todo
from app.models.user import User
from app.main import create_app
from app.services.sync import create_sync_change
from test_project_stage_migration import alembic, disposable_postgres


def snapshot(engine):
    with engine.connect() as connection:
        tables = ("users", "projects", "project_stages", "milestones", "ai_sessions", "todos", "todo_categories", "sync_changes")
        result = {table: list(connection.execute(text(f"SELECT * FROM {table} ORDER BY id")).mappings()) for table in tables}
        result["projects"] = [
            {key: value for key, value in row.items() if key not in {"archived_at", "deleted_at"}}
            for row in result["projects"]
        ]
        result["cursor_sequence"] = tuple(connection.execute(text("SELECT last_value, is_called FROM sync_changes_cursor_seq")).one())
        return result


def test_postgres_links_migration_persistence_constraints_and_serialization(disposable_postgres):
    url = disposable_postgres
    alembic(url, "upgrade", "20261014_0008")
    engine = create_engine(url, future=True)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    owner, project, stage, milestone, session = [uuid4() for _ in range(5)]
    todo_ids = [uuid4() for _ in range(4)]
    with factory() as db:
        db.add(User(id=owner, alias="links-owner", display_name="Owner", timezone="UTC", bootstrap_token_hash=PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1).hash("links-test-token")))
        db.flush()
        db.execute(Project.__table__.insert().values(id=project, user_id=owner, name="Preserved project", manual_progress=42))
        db.add_all([Todo(id=id, user_id=owner, title=f"Synthetic Todo {index}") for index, id in enumerate(todo_ids)])
        db.flush()
        db.add(ProjectStage(id=stage, user_id=owner, project_id=project, name="Current", sort_order=0, is_current=True))
        db.add(Milestone(id=milestone, user_id=owner, project_id=project, title="Milestone", sort_order=0))
        db.add(AISession(id=session, user_id=owner, project_id=project, goal="Session"))
        create_sync_change(db, user_id=owner, change_type="todo.created", entity_type="todo", entity_id=todo_ids[0], entity_version=1, payload={"synthetic": True})
        db.commit()
    before = snapshot(engine)
    alembic(url, "upgrade", "head")
    assert snapshot(engine) == before
    with factory() as db:
        assert db.execute(select(ProjectTodoLink)).first() is None
        assert db.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20261120_0012"

    def override_db():
        with factory() as db:
            yield db

    app = create_app()
    app.dependency_overrides[get_db] = override_db

    def request(method, path, body=None, key=None):
        with TestClient(app) as client:
            headers = {"Authorization": "Bearer links-test-token", "Idempotency-Key": str(key or uuid4())}
            return client.request(method, path, headers=headers, **({"json": body} if body is not None else {}))

    path = f"/api/v1/projects/{project}/todo-links"
    key = uuid4()
    saved = request("PUT", path, {"todo_ids": [str(todo_ids[0])]}, key)
    assert saved.status_code == 200
    assert request("PUT", path, {"todo_ids": [str(todo_ids[0])]}, key).json() == saved.json()
    assert request("GET", path).json()["data"] == saved.json()["data"]
    after_links = snapshot(engine)
    assert after_links["todos"] == before["todos"]
    assert after_links["sync_changes"] == before["sync_changes"]
    assert after_links["cursor_sequence"] == before["cursor_sequence"]

    barrier = Barrier(4)

    def simultaneous(method, route, body):
        barrier.wait(timeout=10)
        return request(method, route, body)

    old_version = request("GET", path).json()["data"]["project_version"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [
            pool.submit(simultaneous, "PATCH", f"/api/v1/projects/{project}", {"manual_progress": 55}),
            pool.submit(simultaneous, "PUT", f"/api/v1/projects/{project}/stages", {"stages": [{"id": str(stage), "name": "Updated stage"}], "current_stage_id": str(stage)}),
            pool.submit(simultaneous, "PUT", f"/api/v1/projects/{project}/milestones", {"milestones": [{"id": str(milestone), "title": "Updated milestone", "target_date": None, "status": "completed"}]}),
            pool.submit(simultaneous, "PUT", path, {"todo_ids": [str(todo_ids[1]), str(todo_ids[0])]}),
        ]
        assert [job.result(timeout=20).status_code for job in jobs] == [200] * 4
    assert request("GET", path).json()["data"]["project_version"] == old_version + 4

    for values in ({"project_id": project, "todo_id": todo_ids[0], "sort_order": 3}, {"project_id": project, "todo_id": uuid4(), "sort_order": 0}, {"project_id": uuid4(), "todo_id": todo_ids[0], "sort_order": 0}, {"project_id": project, "todo_id": todo_ids[2], "sort_order": -1}):
        with factory() as db:
            db.add(ProjectTodoLink(user_id=owner, **values))
            with pytest.raises(IntegrityError):
                db.flush()
            db.rollback()

    # Separate TestClient portals allow real simultaneous transactions instead of one event loop serializing SQL.
    for link_first, todo_id in zip((True, False), todo_ids[2:]):
        locked, attempted, release = Event(), Event(), Event()

        def after_execute(connection, cursor, statement, parameters, context, executemany):
            sql = statement.lower()
            first = ("from todos" in sql and "for update" in sql) if link_first else sql.startswith("update todos set")
            if first:
                locked.set()
                assert release.wait(timeout=10)

        def before_execute(connection, cursor, statement, parameters, context, executemany):
            sql = statement.lower()
            second = sql.startswith("update todos set") if link_first else ("from todos" in sql and "for update" in sql)
            if second:
                attempted.set()

        event.listen(engine, "after_cursor_execute", after_execute)
        event.listen(engine, "before_cursor_execute", before_execute)
        try:
            with ThreadPoolExecutor(max_workers=2) as pool:
                link = lambda: request("PUT", path, {"todo_ids": [str(todo_id)]})
                delete = lambda: request("DELETE", f"/api/v1/todos/{todo_id}")
                first = pool.submit(link if link_first else delete)
                assert locked.wait(timeout=10)
                second = pool.submit(delete if link_first else link)
                try:
                    assert attempted.wait(timeout=10)
                finally:
                    release.set()
                results = (first.result(timeout=20), second.result(timeout=20))
                assert [result.status_code for result in results] == ([200, 200] if link_first else [200, 400])
        finally:
            release.set()
            event.remove(engine, "after_cursor_execute", after_execute)
            event.remove(engine, "before_cursor_execute", before_execute)
        links = request("GET", path).json()["data"]["links"]
        if link_first:
            assert links == [{"todo_id": str(todo_id), "sort_order": 0, "unavailable": True, "todo": None}]

    final = snapshot(engine)
    canonical = request("GET", path).json()["data"]
    alembic(url, "upgrade", "head")
    assert snapshot(engine) == final
    assert request("GET", path).json()["data"] == canonical
    alembic(url, "downgrade", "20261014_0008")
    assert snapshot(engine) == final
    alembic(url, "upgrade", "head")
    assert snapshot(engine) == final
    assert request("GET", path).json()["data"]["links"] == []
    engine.dispose()
