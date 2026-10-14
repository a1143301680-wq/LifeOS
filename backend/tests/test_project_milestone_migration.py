from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.database import get_db
from app.main import create_app
from app.models.ai_session import AISession
from app.models.milestone import Milestone
from app.models.project import Project
from app.models.project_stage import ProjectStage
from app.models.user import User
from test_project_stage_migration import alembic, disposable_postgres


def legacy_snapshot(engine):
    with engine.connect() as connection:
        return {table: list(connection.execute(text(f"SELECT * FROM {table} ORDER BY id")).mappings()) for table in ("users", "projects", "project_stages", "ai_sessions")}


def test_postgres_milestone_migration_api_constraints_and_shared_parent_lock(disposable_postgres):
    url = disposable_postgres
    alembic(url, "upgrade", "20261012_0007")
    engine = create_engine(url, future=True)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    user_id, project_id, stage_id, session_id = [uuid4() for _ in range(4)]
    with factory() as db:
        db.add(User(id=user_id, alias="milestone-owner", display_name="Owner", timezone="UTC", bootstrap_token_hash=PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1).hash("milestone-test-token")))
        db.flush()
        db.add(Project(id=project_id, user_id=user_id, name="Preserved project", type="other", manual_progress=42, version=3))
        db.flush()
        db.add(ProjectStage(id=stage_id, user_id=user_id, project_id=project_id, name="Preserved current", sort_order=0, is_current=True))
        db.add(AISession(id=session_id, user_id=user_id, project_id=project_id, goal="Preserved session"))
        db.commit()
    before = legacy_snapshot(engine)
    alembic(url, "upgrade", "head")
    assert legacy_snapshot(engine) == before
    with factory() as db:
        assert db.execute(select(Milestone)).first() is None
        assert db.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == "20261014_0008"

    def override_db():
        with factory() as db:
            yield db

    app = create_app()
    app.dependency_overrides[get_db] = override_db
    auth = {"Authorization": "Bearer milestone-test-token"}

    def keyed():
        return {**auth, "Idempotency-Key": str(uuid4())}

    milestone_id = str(uuid4())
    with TestClient(app) as client:
        path = f"/api/v1/projects/{project_id}/milestones"
        item = {"id": milestone_id, "title": "PC demo", "target_date": "2028-02-29", "status": "pending"}
        key_headers = keyed()
        saved = client.put(path, headers=key_headers, json={"milestones": [item]})
        assert saved.status_code == 200
        assert client.put(path, headers=key_headers, json={"milestones": [item]}).json() == saved.json()
        assert client.get(path, headers=auth).json()["data"] == saved.json()["data"]
        item.update(target_date=None, status="canceled")
        changed = client.put(path, headers=keyed(), json={"milestones": [item]}).json()["data"]
        assert changed["milestones"][0]["version"] == 2
        assert changed["milestones"][0]["target_date"] is None
        assert client.put(path, headers=keyed(), json={"milestones": []}).status_code == 200
        assert client.put(path, headers=keyed(), json={"milestones": [item]}).status_code == 400
        old_version = client.get(path, headers=auth).json()["data"]["project_version"]
        fresh = {**item, "id": str(uuid4()), "status": "completed"}
        with ThreadPoolExecutor(max_workers=3) as pool:
            jobs = [
                pool.submit(client.patch, f"/api/v1/projects/{project_id}", headers=keyed(), json={"manual_progress": 55}),
                pool.submit(client.put, f"/api/v1/projects/{project_id}/stages", headers=keyed(), json={"stages": [{"id": str(stage_id), "name": "Renamed current"}], "current_stage_id": str(stage_id)}),
                pool.submit(client.put, path, headers=keyed(), json={"milestones": [fresh]}),
            ]
            assert [job.result(timeout=20).status_code for job in jobs] == [200, 200, 200]
        assert client.get(path, headers=auth).json()["data"]["project_version"] == old_version + 3
        assert client.get(f"/api/v1/projects/{project_id}", headers=auth).json()["data"]["manual_progress"] == 55
        assert client.get(f"/api/v1/projects/{project_id}/stages", headers=auth).json()["data"]["current_stage_id"] == str(stage_id)
        canonical = client.get(path, headers=auth).json()["data"]

    with factory() as db:
        tombstone = db.get(Milestone, milestone_id)
        assert tombstone.deleted_at is not None and tombstone.version == 3
    for fields in ({"title": ""}, {"title": "x" * 201}, {"status": "invalid"}, {"sort_order": -1}, {"version": 0}):
        with factory() as db:
            db.add(Milestone(id=uuid4(), user_id=user_id, project_id=project_id, **{"title": "Valid", "status": "pending", "sort_order": 0, "version": 1, **fields}))
            with pytest.raises((DataError, IntegrityError)):
                db.flush()
            db.rollback()
    preserved = legacy_snapshot(engine)
    alembic(url, "upgrade", "head")
    with TestClient(app) as client:
        assert client.get(path, headers=auth).json()["data"] == canonical
    assert legacy_snapshot(engine) == preserved
    alembic(url, "downgrade", "20261012_0007")
    assert legacy_snapshot(engine) == preserved
    alembic(url, "upgrade", "head")
    assert legacy_snapshot(engine) == preserved
    with factory() as db:
        assert db.execute(select(Milestone)).first() is None
    engine.dispose()
