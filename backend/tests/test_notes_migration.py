from concurrent.futures import ThreadPoolExecutor
from threading import Event
from uuid import uuid4

from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker

from app.core.database import get_db
from app.main import create_app
from app.models.project import Project
from app.models.todo import Todo
from app.models.user import User
from app.services.sync import create_sync_change
from test_project_lifecycle_migration import snapshot
from test_project_stage_migration import alembic, disposable_postgres


def test_notes_postgres_round_trip_persistence_and_row_lock(disposable_postgres):
    url = disposable_postgres
    alembic(url, "upgrade", "20261109_0011")
    engine = create_engine(url)
    factory = sessionmaker(bind=engine, autoflush=False)
    owner, project, todo = uuid4(), uuid4(), uuid4()
    with factory.begin() as db:
        db.add(User(id=owner, alias="notes", display_name="Notes", timezone="UTC",
                    bootstrap_token_hash=PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1).hash("synthetic-notes")))
        db.flush()
        db.add(Project(id=project, user_id=owner, name="Source Project"))
        db.add(Todo(id=todo, user_id=owner, title="Source Todo"))
        db.flush()
        create_sync_change(db, user_id=owner, change_type="todo.created", entity_type="todo", entity_id=todo, entity_version=1, payload={})
    before = snapshot(engine)
    alembic(url, "upgrade", "head")
    assert snapshot(engine) == before
    with engine.connect() as conn:
        assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20261120_0012"
        assert conn.execute(text("SELECT count(*) FROM notes")).scalar_one() == 0

    app = create_app()

    def session():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = session

    def request(method, path="", payload=None, key=None):
        options = {"json": payload} if payload is not None else {}
        with TestClient(app) as api:
            return api.request(method, "/api/v1/notes" + path, headers={
                "Authorization": "Bearer synthetic-notes", "Idempotency-Key": str(key or uuid4()),
            }, **options)

    for delete_first in (False, True):
        created = request("POST", payload={"title": "Saved", "project_id": str(project), "todo_id": str(todo)})
        assert created.status_code == 201
        data = created.json()["data"]
        route = "/" + data["id"]
        assert request("GET", route).json()["data"] == data
        held, waiting, release = Event(), Event(), Event()

        def before_sql(conn, cursor, statement, parameters, context, many):
            if held.is_set() and "FOR UPDATE" in statement and "FROM notes" in statement:
                waiting.set()

        def after_sql(conn, cursor, statement, parameters, context, many):
            if "FOR UPDATE" in statement and "FROM notes" in statement and not held.is_set():
                held.set()
                assert release.wait(10)

        patch = ("PATCH", route, {"title": "Edited"})
        delete = ("DELETE", route, None, uuid4())
        one, two = (delete, patch) if delete_first else (patch, delete)
        event.listen(engine, "before_cursor_execute", before_sql)
        event.listen(engine, "after_cursor_execute", after_sql)
        try:
            with ThreadPoolExecutor(max_workers=2) as pool:
                first = pool.submit(request, *one)
                try:
                    assert held.wait(10)
                    second = pool.submit(request, *two)
                    assert waiting.wait(10)
                finally:
                    release.set()
                early, late = first.result(15), second.result(15)
        finally:
            event.remove(engine, "before_cursor_execute", before_sql)
            event.remove(engine, "after_cursor_execute", after_sql)
        assert (early.status_code, late.status_code) == ((200, 404) if delete_first else (200, 200))
        deleted = early if delete_first else late
        assert deleted.json()["data"]["version"] == (2 if delete_first else 3)
        assert request(*delete).json() == deleted.json()
        assert request("GET", route).status_code == 404

    kept = request("POST", payload={"title": "Before downgrade"}).json()["data"]
    assert request("GET", "/"+kept["id"]).status_code == 200
    assert snapshot(engine) == before
    alembic(url, "downgrade", "20261109_0011")
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT to_regclass('notes')")) is None
    assert snapshot(engine) == before
    alembic(url, "upgrade", "head")
    assert request("GET").json()["items"] == []
    assert snapshot(engine) == before
    engine.dispose()
