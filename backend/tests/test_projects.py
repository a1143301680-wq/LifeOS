from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import create_app
from app.models.idempotency import IdempotencyKey
from app.models.project import Project
from app.models.sync import SyncChange
from app.models.user import User


@pytest.fixture()
def project_client(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'projects-test.db'}", future=True)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    tokens = {"me": "project-token-me", "partner": "project-token-partner"}
    with session_factory() as db:
        db.add_all([
            User(id=uuid4(), alias=alias, display_name=alias.title(), bootstrap_token_hash=hasher.hash(token), timezone="Asia/Shanghai")
            for alias, token in tokens.items()
        ])
        db.commit()

    def override_get_db():
        with session_factory() as db:
            yield db

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        client.tokens = tokens
        client.session_factory = session_factory
        yield client
    engine.dispose()


def headers(client, alias="me", key=None):
    result = {"Authorization": f"Bearer {client.tokens[alias]}"}
    if key is not None:
        result["Idempotency-Key"] = key
    return result


def test_create_project_defaults_and_owned_readback(project_client):
    created = project_client.post(
        "/api/v1/projects",
        headers=headers(project_client, key=str(uuid4())),
        json={"name": "  Build LifeOS  "},
    )
    assert created.status_code == 201
    project = created.json()["data"]
    assert project["name"] == "Build LifeOS"
    assert project["type"] == "other"
    assert project["status"] == "planning"
    assert project["manual_progress"] == 0
    assert project["is_pinned"] is False
    assert project["version"] == 1
    assert project["description"] is None
    assert project["next_step"] is None
    assert "user_id" not in project
    assert "sync" not in created.json()

    listed = project_client.get("/api/v1/projects", headers=headers(project_client))
    detail = project_client.get(f"/api/v1/projects/{project['id']}", headers=headers(project_client))
    assert listed.status_code == 200
    assert listed.json()["items"] == [project]
    assert detail.status_code == 200
    assert detail.json()["data"] == project


def test_projects_are_isolated_by_bearer_identity(project_client):
    mine = project_client.post(
        "/api/v1/projects", headers=headers(project_client, key=str(uuid4())), json={"name": "My goal"}
    ).json()["data"]
    partner = project_client.post(
        "/api/v1/projects", headers=headers(project_client, "partner", str(uuid4())), json={"name": "Partner goal"}
    ).json()["data"]

    listed = project_client.get("/api/v1/projects", headers=headers(project_client))
    foreign_detail = project_client.get(f"/api/v1/projects/{partner['id']}", headers=headers(project_client))
    foreign_patch = project_client.patch(
        f"/api/v1/projects/{partner['id']}", headers=headers(project_client, key=str(uuid4())), json={"name": "No"}
    )
    missing_detail = project_client.get(f"/api/v1/projects/{uuid4()}", headers=headers(project_client))
    no_auth = project_client.get("/api/v1/projects")
    bad_auth = project_client.get("/api/v1/projects", headers={"Authorization": "Bearer wrong"})

    assert [item["id"] for item in listed.json()["items"]] == [mine["id"]]
    assert foreign_detail.status_code == foreign_patch.status_code == missing_detail.status_code == 404
    assert foreign_detail.json()["error"]["code"] == "not_found"
    assert foreign_detail.json()["error"]["message"] == missing_detail.json()["error"]["message"]
    assert no_auth.status_code == bad_auth.status_code == 401
    assert project_client.get("/api/v1/projects", headers=headers(project_client, "partner")).json()["items"] == [partner]


def test_project_patch_noop_and_replay_preserve_version_and_timestamp(project_client):
    created = project_client.post(
        "/api/v1/projects", headers=headers(project_client, key=str(uuid4())),
        json={"name": "Focus", "description": "Notes", "next_step": "Review"},
    ).json()["data"]
    key = str(uuid4())
    payload = {"name": "  Focus  ", "description": " Notes ", "next_step": "Review"}
    first = project_client.patch(f"/api/v1/projects/{created['id']}", headers=headers(project_client, key=key), json=payload)
    replay = project_client.patch(f"/api/v1/projects/{created['id']}", headers=headers(project_client, key=key), json=payload)
    changed = project_client.patch(
        f"/api/v1/projects/{created['id']}", headers=headers(project_client, key=str(uuid4())),
        json={"manual_progress": 40, "status": "in_progress", "is_pinned": True, "next_step": "  "},
    )

    assert first.status_code == replay.status_code == changed.status_code == 200
    assert first.json() == replay.json()
    assert first.json()["data"] == created
    updated = changed.json()["data"]
    assert updated["version"] == 2
    assert updated["updated_at"] != created["updated_at"]
    assert updated["manual_progress"] == 40
    assert updated["status"] == "in_progress"
    assert updated["is_pinned"] is True
    assert updated["next_step"] is None
    with project_client.session_factory() as db:
        assert len(db.execute(select(Project)).all()) == 1
        assert len(db.execute(select(IdempotencyKey)).all()) == 3
        assert len(db.execute(select(SyncChange)).all()) == 0


def test_project_writes_require_idempotency_and_reject_conflicts(project_client):
    missing = project_client.post("/api/v1/projects", headers=headers(project_client), json={"name": "Goal"})
    malformed = project_client.post("/api/v1/projects", headers=headers(project_client, key="bad"), json={"name": "Goal"})
    key = str(uuid4())
    first = project_client.post("/api/v1/projects", headers=headers(project_client, key=key), json={"name": "Goal"})
    replay = project_client.post("/api/v1/projects", headers=headers(project_client, key=key), json={"name": "Goal"})
    conflict = project_client.post("/api/v1/projects", headers=headers(project_client, key=key), json={"name": "Different"})
    patch_missing = project_client.patch(
        f"/api/v1/projects/{first.json()['data']['id']}", headers=headers(project_client), json={"name": "Changed"}
    )

    assert missing.status_code == malformed.status_code == patch_missing.status_code == 400
    assert missing.json()["error"]["code"] == "idempotency_key_required"
    assert malformed.json()["error"]["code"] == "validation_error"
    assert first.status_code == replay.status_code == 201
    assert first.json() == replay.json()
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_key_conflict"
    with project_client.session_factory() as db:
        assert len(db.execute(select(Project)).all()) == 1
        assert len(db.execute(select(IdempotencyKey)).all()) == 1


def test_project_patch_replay_and_conflict_do_not_increment_version_twice(project_client):
    created = project_client.post(
        "/api/v1/projects", headers=headers(project_client, key=str(uuid4())), json={"name": "Goal"}
    ).json()["data"]
    path = f"/api/v1/projects/{created['id']}"
    key = str(uuid4())
    first = project_client.patch(path, headers=headers(project_client, key=key), json={"manual_progress": 25})
    replay = project_client.patch(path, headers=headers(project_client, key=key), json={"manual_progress": 25})
    conflict = project_client.patch(path, headers=headers(project_client, key=key), json={"manual_progress": 50})

    assert first.status_code == replay.status_code == 200
    assert first.json() == replay.json()
    assert first.json()["data"]["version"] == 2
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "idempotency_key_conflict"
    stored = project_client.get(path, headers=headers(project_client)).json()["data"]
    assert stored["manual_progress"] == 25
    assert stored["version"] == 2
    with project_client.session_factory() as db:
        assert len(db.execute(select(IdempotencyKey)).all()) == 2


def test_project_validation_rejects_invalid_and_server_owned_fields(project_client):
    invalid_create = [
        {"name": "   "}, {"name": "x" * 201}, {"name": "Valid", "type": "unknown"},
        {"name": "Valid", "status": "unknown"}, {"name": "Valid", "manual_progress": -1},
        {"name": "Valid", "manual_progress": 101}, {"name": "Valid", "manual_progress": True},
        {"name": "Valid", "description": "x" * 2001}, {"name": "Valid", "next_step": "x" * 1001},
        {"name": "Valid", "user_id": str(uuid4())}, {"name": "Valid", "version": 9},
    ]
    for payload in invalid_create:
        response = project_client.post("/api/v1/projects", headers=headers(project_client, key=str(uuid4())), json=payload)
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"

    created = project_client.post(
        "/api/v1/projects", headers=headers(project_client, key=str(uuid4())), json={"name": "Valid"}
    ).json()["data"]
    invalid_patch = [
        {}, {"name": None}, {"name": "  "}, {"type": None}, {"status": None},
        {"manual_progress": None}, {"manual_progress": 101}, {"is_pinned": None},
        {"id": str(uuid4())}, {"user_id": str(uuid4())}, {"version": 12},
        {"created_at": "2026-10-09T00:00:00Z"}, {"updated_at": "2026-10-09T00:00:00Z"},
    ]
    for payload in invalid_patch:
        response = project_client.patch(
            f"/api/v1/projects/{created['id']}", headers=headers(project_client, key=str(uuid4())), json=payload
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "validation_error"
    assert project_client.get(f"/api/v1/projects/{created['id']}", headers=headers(project_client)).json()["data"] == created


def test_project_list_is_pinned_then_recent_then_id(project_client):
    same_time = datetime(2026, 10, 9, 10, 0, tzinfo=timezone.utc)
    earlier = datetime(2026, 10, 8, 10, 0, tzinfo=timezone.utc)
    ids = [UUID(int=value) for value in (3, 1, 2, 4)]
    with project_client.session_factory() as db:
        user_id = db.execute(select(User.id).where(User.alias == "me")).scalar_one()
        db.add_all([
            Project(id=ids[0], user_id=user_id, name="Unpinned", is_pinned=False, updated_at=same_time),
            Project(id=ids[1], user_id=user_id, name="Pinned low ID", is_pinned=True, updated_at=same_time),
            Project(id=ids[2], user_id=user_id, name="Pinned high ID", is_pinned=True, updated_at=same_time),
            Project(id=ids[3], user_id=user_id, name="Pinned older", is_pinned=True, updated_at=earlier),
        ])
        db.commit()

    response = project_client.get("/api/v1/projects", headers=headers(project_client))
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [str(ids[1]), str(ids[2]), str(ids[3]), str(ids[0])]
