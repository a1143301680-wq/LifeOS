from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import create_app
from app.models.project import Project
from app.models.ai_session import AISession
from app.models.idempotency import IdempotencyKey
from app.models.sync import SyncChange
from app.models.user import User


@pytest.fixture()
def client(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'ai-sessions.db'}", future=True)
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    with session_factory() as db:
        for alias in ("me", "partner"):
            user = User(id=uuid4(), alias=alias, display_name=alias, bootstrap_token_hash=hasher.hash(f"token-{alias}"), timezone="Asia/Shanghai")
            db.add(user)
            db.flush()
            db.add(Project(id=uuid4(), user_id=user.id, name=f"{alias} project"))
        db.commit()

    def override_get_db():
        with session_factory() as db:
            yield db

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        test_client.session_factory = session_factory
        yield test_client
    engine.dispose()


def headers(alias="me", key=None):
    result = {"Authorization": f"Bearer token-{alias}"}
    if key:
        result["Idempotency-Key"] = key
    return result


def project_id(client, alias="me"):
    from sqlalchemy import select
    from app.models.user import User

    with client.session_factory() as db:
        return str(db.execute(select(Project.id).join(User).where(User.alias == alias)).scalar_one())


def test_create_and_list_ai_session_under_owned_project(client):
    project = project_id(client)
    path = f"/api/v1/projects/{project}/ai-sessions"
    created = client.post(path, headers=headers(key=str(uuid4())), json={"goal": "  Ship the next slice  "})
    assert created.status_code == 201
    session = created.json()["data"]
    assert session["goal"] == "Ship the next slice"
    assert session["version"] == 1
    assert session["ended_at"] is None
    assert session["started_at"].endswith("Z")
    assert "user_id" not in session
    assert client.get(path, headers=headers()).json()["items"] == [session]
    assert client.get(f"{path}/{session['id']}", headers=headers()).json()["data"] == session


def test_session_time_normalization_merged_range_and_noop(client):
    path = f"/api/v1/projects/{project_id(client)}/ai-sessions"
    created = client.post(path, headers=headers(key=str(uuid4())), json={
        "goal": "Time test", "started_at": "2026-10-10T08:00:00+08:00", "ended_at": "2026-10-10T01:00:00Z",
    }).json()["data"]
    detail = f"{path}/{created['id']}"
    assert created["started_at"] == "2026-10-10T00:00:00Z"
    assert created["ended_at"] == "2026-10-10T01:00:00Z"

    noop = client.patch(detail, headers=headers(key=str(uuid4())), json={"started_at": "2026-10-09T19:00:00-05:00"})
    assert noop.status_code == 200
    assert noop.json()["data"] == created
    invalid_start = client.patch(detail, headers=headers(key=str(uuid4())), json={"started_at": "2026-10-10T02:00:00Z"})
    invalid_end = client.patch(detail, headers=headers(key=str(uuid4())), json={"ended_at": "2026-10-09T23:59:59Z"})
    assert invalid_start.status_code == invalid_end.status_code == 400
    assert invalid_start.json()["error"]["code"] == "validation_error"
    assert invalid_end.json()["error"]["code"] == "validation_error"
    cleared = client.patch(detail, headers=headers(key=str(uuid4())), json={"ended_at": None})
    assert cleared.status_code == 200
    assert cleared.json()["data"]["ended_at"] is None
    assert cleared.json()["data"]["version"] == 2
    moved = client.patch(detail, headers=headers(key=str(uuid4())), json={"started_at": "2026-10-10T02:00:00Z"})
    assert moved.status_code == 200
    assert moved.json()["data"]["started_at"] == "2026-10-10T02:00:00Z"
    equal = client.patch(detail, headers=headers(key=str(uuid4())), json={"ended_at": "2026-10-10T10:00:00+08:00"})
    assert equal.status_code == 200
    assert equal.json()["data"]["ended_at"] == moved.json()["data"]["started_at"]


def test_session_owner_and_parent_project_are_isolated(client):
    mine = project_id(client)
    partner = project_id(client, "partner")
    with client.session_factory() as db:
        user_id = db.execute(select(User.id).where(User.alias == "me")).scalar_one()
        other = Project(user_id=user_id, name="second project")
        db.add(other)
        db.commit()
        other_id = str(other.id)
    path = f"/api/v1/projects/{mine}/ai-sessions"
    session = client.post(path, headers=headers(key=str(uuid4())), json={"goal": "Private"}).json()["data"]
    for method, target in (
        ("GET", f"/api/v1/projects/{partner}/ai-sessions"),
        ("POST", f"/api/v1/projects/{partner}/ai-sessions"),
        ("GET", f"/api/v1/projects/{partner}/ai-sessions/{session['id']}"),
        ("GET", f"/api/v1/projects/{other_id}/ai-sessions/{session['id']}"),
        ("PATCH", f"/api/v1/projects/{other_id}/ai-sessions/{session['id']}"),
    ):
        kwargs = {"headers": headers(key=str(uuid4()))}
        if method != "GET":
            kwargs["json"] = {"goal": "Not allowed"}
        response = client.request(method, target, **kwargs)
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"
    assert client.get(path, headers=headers("partner")).status_code == 404
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_session_write_idempotency_and_order(client):
    path = f"/api/v1/projects/{project_id(client)}/ai-sessions"
    key = str(uuid4())
    first = client.post(path, headers=headers(key=key), json={"goal": "A", "started_at": "2026-10-10T00:00:00Z"})
    replay = client.post(path, headers=headers(key=key), json={"started_at": "2026-10-10T00:00:00Z", "goal": "A"})
    conflict = client.post(path, headers=headers(key=key), json={"goal": "B"})
    second = client.post(path, headers=headers(key=str(uuid4())), json={"goal": "B", "started_at": "2026-10-11T00:00:00Z"})
    assert first.status_code == replay.status_code == second.status_code == 201
    assert first.json() == replay.json()
    assert conflict.status_code == 409
    listed = client.get(path, headers=headers()).json()["items"]
    assert [item["goal"] for item in listed] == ["B", "A"]
    detail = f"{path}/{first.json()['data']['id']}"
    patch_key = str(uuid4())
    changed = client.patch(detail, headers=headers(key=patch_key), json={"next_step": "Review"})
    patch_replay = client.patch(detail, headers=headers(key=patch_key), json={"next_step": "Review"})
    patch_conflict = client.patch(detail, headers=headers(key=patch_key), json={"next_step": "Different"})
    assert changed.status_code == patch_replay.status_code == 200
    assert changed.json() == patch_replay.json()
    assert changed.json()["data"]["version"] == 2
    assert patch_conflict.status_code == 409
    with client.session_factory() as db:
        assert len(db.execute(select(AISession)).all()) == 2
        assert len(db.execute(select(IdempotencyKey)).all()) == 3
        assert len(db.execute(select(SyncChange)).all()) == 0


def test_session_rejects_malformed_fields_and_requires_write_key(client):
    path = f"/api/v1/projects/{project_id(client)}/ai-sessions"
    invalid = [
        {}, {"goal": " "}, {"goal": None}, {"goal": "x" * 501},
        {"goal": "A", "ai_tool": "x" * 101}, {"goal": "A", "completed_work": "x" * 4001},
        {"goal": "A", "started_at": None}, {"goal": "A", "started_at": "2026-10-10T01:00:00"},
        {"goal": "A", "ended_at": "2026-10-10T01:00:00"},
        {"goal": "A", "started_at": "2026-10-10T02:00:00Z", "ended_at": "2026-10-10T01:00:00Z"},
        {"goal": "A", "user_id": str(uuid4())}, {"goal": "A", "project_id": str(uuid4())},
        {"goal": "A", "version": 9},
    ]
    for body in invalid:
        response = client.post(path, headers=headers(key=str(uuid4())), json=body)
        assert response.status_code == 400, body
        assert response.json()["error"]["code"] == "validation_error"
    missing_key = client.post(path, headers=headers(), json={"goal": "Valid"})
    assert missing_key.status_code == 400
    assert missing_key.json()["error"]["code"] == "idempotency_key_required"
    created = client.post(path, headers=headers(key=str(uuid4())), json={"goal": "Valid"}).json()["data"]
    detail = f"{path}/{created['id']}"
    for body in ({}, {"goal": None}, {"started_at": None}, {"user_id": str(uuid4())}, {"version": 10}):
        response = client.patch(detail, headers=headers(key=str(uuid4())), json=body)
        assert response.status_code == 400, body
        assert response.json()["error"]["code"] == "validation_error"
    assert client.patch(detail, headers=headers(), json={"goal": "Changed"}).json()["error"]["code"] == "idempotency_key_required"


def test_session_optional_fields_normalize_clear_and_tied_order(client):
    path = f"/api/v1/projects/{project_id(client)}/ai-sessions"
    first = client.post(path, headers=headers(key=str(uuid4())), json={
        "goal": "  First  ", "completed_work": "  Done  ", "ai_tool": "  Codex  ",
        "started_at": "2026-10-10T00:00:00Z",
    }).json()["data"]
    second = client.post(path, headers=headers(key=str(uuid4())), json={
        "goal": "Second", "started_at": "2026-10-10T08:00:00+08:00",
    }).json()["data"]
    listed = client.get(path, headers=headers()).json()["items"]
    assert [item["id"] for item in listed] == sorted([first["id"], second["id"]])
    detail = f"{path}/{first['id']}"
    noop = client.patch(detail, headers=headers(key=str(uuid4())), json={
        "goal": " First ", "completed_work": " Done ", "ai_tool": " Codex ",
    })
    assert noop.status_code == 200
    assert noop.json()["data"] == first
    cleared = client.patch(detail, headers=headers(key=str(uuid4())), json={
        "completed_work": "  ", "ai_tool": None,
    })
    assert cleared.status_code == 200
    assert cleared.json()["data"]["completed_work"] is None
    assert cleared.json()["data"]["ai_tool"] is None
    assert cleared.json()["data"]["version"] == 2
