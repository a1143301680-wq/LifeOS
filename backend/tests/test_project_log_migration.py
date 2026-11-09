from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import DBAPIError
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
from test_project_stage_migration import alembic, disposable_postgres
from test_project_todo_link_migration import snapshot


def legacy(engine):
    result = snapshot(engine)
    with engine.connect() as conn:
        result["project_todo_links"] = list(conn.execute(text("SELECT * FROM project_todo_links ORDER BY project_id, todo_id")).mappings())
    return result


def test_postgres_logs_round_trip_timeline_constraints_and_shared_lock(disposable_postgres):
    alembic(disposable_postgres, "upgrade", "20261015_0009")
    engine = create_engine(disposable_postgres)
    factory = sessionmaker(bind=engine, autoflush=False)
    owner, project, stage, milestone, source = [uuid4() for _ in range(5)]
    time = datetime(2026, 10, 15, 2, 0, 0, 123456, timezone.utc)
    with factory() as db:
        db.add(User(id=owner, alias="logs-owner", display_name="Owner", timezone="UTC", bootstrap_token_hash=PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1).hash("logs-synthetic-token")))
        db.flush()
        db.add(Project(id=project, user_id=owner, name="Preserved", manual_progress=42))
        db.add(Todo(id=source, user_id=owner, title="Completed source", status="completed", completed_at=time.astimezone(timezone(timedelta(hours=8)))))
        db.flush()
        db.add(ProjectStage(id=stage, user_id=owner, project_id=project, name="Stage", sort_order=0))
        db.add(Milestone(id=milestone, user_id=owner, project_id=project, title="Milestone", sort_order=0))
        db.add(AISession(id=source, user_id=owner, project_id=project, goal="Session", started_at=time))
        db.add(ProjectTodoLink(user_id=owner, project_id=project, todo_id=source, sort_order=0, created_at=time))
        create_sync_change(db, user_id=owner, change_type="todo.created", entity_type="todo", entity_id=source, entity_version=1, payload={"synthetic": True})
        db.commit()
    before = legacy(engine)
    alembic(disposable_postgres, "upgrade", "head")
    assert legacy(engine) == before
    with factory() as db:
        assert db.execute(select(ProjectLog)).first() is None
        assert db.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20261015_0010"

    def override_db():
        with factory() as db:
            yield db

    app = create_app()
    app.dependency_overrides[get_db] = override_db

    def request(method, route, payload=None, key=None):
        with TestClient(app) as client:
            return client.request(method, route, headers={"Authorization": "Bearer logs-synthetic-token", "Idempotency-Key": str(key or uuid4())}, **({"json": payload} if payload is not None else {}))

    path = f"/api/v1/projects/{project}"
    key = uuid4()
    saved = request("POST", path + "/logs", {"title": "Manual", "content": "Retained history"}, key)
    assert saved.status_code == 201
    assert request("POST", path + "/logs", {"title": "Manual", "content": "Retained history"}, key).json() == saved.json()
    log_id = saved.json()["data"]["id"]
    assert request("GET", path + f"/logs/{log_id}").json()["data"] == saved.json()["data"]
    # Same instant and UUID across tables must use kind rank, not just UUID as the seek key.
    with factory() as db:
        row = db.get(ProjectLog, log_id)
        row.id = source
        row.created_at = time
        db.commit()
    entries, cursor = [], None
    for _ in range(3):
        route = path + "/timeline?limit=1" + ("&cursor=" + cursor if cursor else "")
        page = request("GET", route).json()
        entries.extend(page["items"])
        cursor = page["next_cursor"]
    assert [entry["kind"] for entry in entries] == ["manual_log", "ai_session", "todo_completed"]
    assert cursor is None
    assert all(datetime.fromisoformat(entry["occurred_at"]) == time for entry in entries)
    assert request("PATCH", path + f"/logs/{source}", {"content": None}).json()["data"]["version"] == 2
    initial_version = request("GET", path).json()["data"]["version"]
    barrier = Barrier(5)

    def concurrent(method, route, body):
        barrier.wait(timeout=10)
        return request(method, route, body)

    with ThreadPoolExecutor(max_workers=5) as pool:
        jobs = [
            pool.submit(concurrent, "POST", path + "/logs", {"title": "Concurrent"}),
            pool.submit(concurrent, "PATCH", path, {"manual_progress": 55}),
            pool.submit(concurrent, "PUT", path + "/stages", {"stages": [{"id": str(stage), "name": "Changed"}], "current_stage_id": str(stage)}),
            pool.submit(concurrent, "PUT", path + "/milestones", {"milestones": [{"id": str(milestone), "title": "Changed", "target_date": None, "status": "completed"}]}),
            pool.submit(concurrent, "PUT", path + "/todo-links", {"todo_ids": []}),
        ]
        assert [job.result(timeout=20).status_code for job in jobs] == [201, 200, 200, 200, 200]
    assert request("GET", path).json()["data"]["version"] == initial_version + 5
    deleted = request("DELETE", path + f"/logs/{source}")
    assert deleted.status_code == 200
    assert request("GET", path + f"/logs/{source}").status_code == 410
    for bad in ({"title": ""}, {"title": "x" * 201}, {"title": "ok", "content": "x" * 4001}, {"title": "ok", "version": 0}, {"title": "ok", "project_id": uuid4()}, {"title": "ok", "user_id": uuid4()}):
        with factory() as db:
            db.add(ProjectLog(**{"user_id": owner, "project_id": project, **bad}))
            with pytest.raises(DBAPIError):
                db.flush()
            db.rollback()
    after = legacy(engine)
    assert after["todos"] == before["todos"]
    assert after["ai_sessions"] == before["ai_sessions"]
    assert after["sync_changes"] == before["sync_changes"] and after["cursor_sequence"] == before["cursor_sequence"]
    alembic(disposable_postgres, "upgrade", "head")
    assert legacy(engine) == after
    alembic(disposable_postgres, "downgrade", "20261015_0009")
    assert legacy(engine) == after
    alembic(disposable_postgres, "upgrade", "head")
    assert legacy(engine) == after
    assert request("GET", path + f"/logs/{source}").status_code == 404
    engine.dispose()
