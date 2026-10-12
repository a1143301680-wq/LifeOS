import os
import socket
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.core.database import get_db
from app.main import create_app
from app.models.ai_session import AISession
from app.models.project import Project
from app.models.project_stage import ProjectStage
from app.models.user import User
from app.services.project_stages import DEFAULT_STAGE_NAMES


BACKEND = Path(__file__).resolve().parents[1]


def run_command(arguments, *, env=None, cwd=None, capture=True):
    output = {"capture_output": True, "text": True} if capture else {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    result = subprocess.run(arguments, env=env, cwd=cwd, timeout=90, **output)
    assert result.returncode == 0, (result.stdout or "") + (result.stderr or "")


@pytest.fixture()
def disposable_postgres():
    bin_dir = os.getenv("LIFEOS_TEST_PG_BIN")
    if not bin_dir:
        pytest.skip("LIFEOS_TEST_PG_BIN must point to PostgreSQL binaries for disposable migration verification")
    initdb = Path(bin_dir) / "initdb.exe"
    pg_ctl = Path(bin_dir) / "pg_ctl.exe"
    if not initdb.is_file() or not pg_ctl.is_file():
        pytest.skip("PostgreSQL initdb/pg_ctl binaries are unavailable")

    with tempfile.TemporaryDirectory(prefix="lifeos-task034-pg-") as temp:
        data_dir = Path(temp) / "data"
        log_file = Path(temp) / "postgres.log"
        run_command([str(initdb), "-D", str(data_dir), "-U", "postgres", "-A", "trust", "--encoding", "UTF8", "--no-locale"])
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        run_command([str(pg_ctl), "-D", str(data_dir), "-l", str(log_file), "-o", f"-h 127.0.0.1 -p {port}", "-w", "start"], capture=False)
        try:
            yield f"postgresql+psycopg://postgres@127.0.0.1:{port}/postgres"
        finally:
            run_command([str(pg_ctl), "-D", str(data_dir), "-m", "immediate", "-w", "stop"], capture=False)


def alembic(url, command, revision):
    env = {**os.environ, "DATABASE_URL": url}
    run_command([sys.executable, "-m", "alembic", "-c", "alembic.ini", command, revision], env=env, cwd=BACKEND)


def test_disposable_postgres_backfill_round_trip_and_concurrent_writes(disposable_postgres):
    url = disposable_postgres
    alembic(url, "upgrade", "20261010_0006")
    engine = create_engine(url, future=True)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    ids = {}
    with factory() as db:
        user = User(id=uuid4(), alias="migration-owner", display_name="Owner", bootstrap_token_hash=PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1).hash("migration-token"), timezone="UTC")
        db.add(user)
        db.flush()
        for project_type in DEFAULT_STAGE_NAMES:
            project = Project(id=uuid4(), user_id=user.id, name=project_type, type=project_type, manual_progress=39, version=7)
            db.add(project)
            ids[project_type] = project.id
        db.flush()
        ai = AISession(id=uuid4(), user_id=user.id, project_id=ids["development"], goal="Preserve session")
        ai_id = ai.id
        db.add(ai)
        db.commit()

    alembic(url, "upgrade", "20261012_0007")
    with factory() as db:
        for project_type, project_id in ids.items():
            project = db.get(Project, project_id)
            rows = db.execute(select(ProjectStage).where(ProjectStage.project_id == project_id).order_by(ProjectStage.sort_order)).scalars().all()
            assert [row.name for row in rows] == list(DEFAULT_STAGE_NAMES[project_type])
            assert all(not row.is_current for row in rows)
            assert project.version == 7 and project.manual_progress == 39
        assert db.get(AISession, ai_id).goal == "Preserve session"
        edited = db.execute(select(ProjectStage).where(ProjectStage.project_id == ids["learning"])).scalars().all()
        for row in edited:
            db.delete(row)
        db.commit()
    alembic(url, "upgrade", "head")
    with factory() as db:
        assert db.execute(select(ProjectStage).where(ProjectStage.project_id == ids["learning"])).first() is None

    def override_db():
        with factory() as db:
            yield db

    app = create_app()
    app.dependency_overrides[get_db] = override_db
    token_headers = {"Authorization": "Bearer migration-token"}
    with TestClient(app) as client:
        created = client.post(
            "/api/v1/projects", headers={**token_headers, "Idempotency-Key": str(uuid4())},
            json={"name": "New pet goal", "type": "pet"},
        )
        assert created.status_code == 201
        seeded = client.get(f"/api/v1/projects/{created.json()['data']['id']}/stages", headers=token_headers)
        assert [row["name"] for row in seeded.json()["data"]["stages"]] == list(DEFAULT_STAGE_NAMES["pet"])
        assert seeded.json()["data"]["current_stage_id"] is None
        project_id = ids["development"]
        path = f"/api/v1/projects/{project_id}/stages"
        collection = client.get(path, headers=token_headers).json()["data"]
        rows = [{"id": row["id"], "name": row["name"]} for row in collection["stages"]]
        with ThreadPoolExecutor(max_workers=2) as pool:
            stage_write = pool.submit(client.put, path, headers={**token_headers, "Idempotency-Key": str(uuid4())}, json={"stages": rows, "current_stage_id": rows[0]["id"]})
            parent_write = pool.submit(client.patch, f"/api/v1/projects/{project_id}", headers={**token_headers, "Idempotency-Key": str(uuid4())}, json={"manual_progress": 55})
            assert stage_write.result().status_code == 200
            assert parent_write.result().status_code == 200
        assert client.get(path, headers=token_headers).json()["data"]["current_stage_id"] == rows[0]["id"]
        parent = client.get(f"/api/v1/projects/{project_id}", headers=token_headers).json()["data"]
        assert parent["version"] == 9 and parent["manual_progress"] == 55

    with factory() as db:
        second = db.execute(
            select(ProjectStage).where(ProjectStage.project_id == ids["development"], ProjectStage.is_current.is_(False))
        ).scalars().first()
        second.is_current = True
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

    alembic(url, "downgrade", "20261010_0006")
    with factory() as db:
        assert db.get(Project, ids["development"]).version == 9
        assert db.get(AISession, ai_id).goal == "Preserve session"
    alembic(url, "upgrade", "head")
    with factory() as db:
        rows = db.execute(select(ProjectStage).where(ProjectStage.project_id == ids["learning"])).scalars().all()
        assert len(rows) == len(DEFAULT_STAGE_NAMES["learning"])
        assert all(not row.is_current for row in rows)
    engine.dispose()
