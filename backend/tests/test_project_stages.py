from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import create_app
from app.models.idempotency import IdempotencyKey
from app.models.project import Project
from app.models.project_stage import ProjectStage
from app.models.user import User
from app.services.project_stages import DEFAULT_STAGE_NAMES


@pytest.fixture()
def client(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'project-stages.db'}", future=True)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(engine)
    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    with factory() as db:
        db.add_all([
            User(id=uuid4(), alias=alias, display_name=alias, bootstrap_token_hash=hasher.hash(alias), timezone="UTC")
            for alias in ("me", "partner")
        ])
        db.commit()

    def override_db():
        with factory() as db:
            yield db

    app = create_app()
    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        test_client.factory = factory
        yield test_client
    engine.dispose()


def headers(alias="me", key=None):
    result = {"Authorization": f"Bearer {alias}"}
    if key is not None:
        result["Idempotency-Key"] = str(key)
    return result


def create_project(client, project_type="development", alias="me"):
    response = client.post(
        "/api/v1/projects", headers=headers(alias, uuid4()),
        json={"name": f"{project_type} project", "type": project_type, "manual_progress": 42, "next_step": "Next"},
    )
    assert response.status_code == 201, response.text
    return response.json()["data"]


def get_collection(client, project_id, alias="me"):
    return client.get(f"/api/v1/projects/{project_id}/stages", headers=headers(alias))


def put_collection(client, project_id, stages, current=None, *, alias="me", key=None):
    return client.put(
        f"/api/v1/projects/{project_id}/stages", headers=headers(alias, key or uuid4()),
        json={"stages": stages, "current_stage_id": current},
    )


@pytest.mark.parametrize("project_type", list(DEFAULT_STAGE_NAMES))
def test_create_seeds_exact_defaults_without_current(client, project_type):
    project = create_project(client, project_type)
    response = get_collection(client, project["id"])
    assert response.status_code == 200
    data = response.json()["data"]
    assert [stage["name"] for stage in data["stages"]] == list(DEFAULT_STAGE_NAMES[project_type])
    assert [stage["sort_order"] for stage in data["stages"]] == list(range(len(data["stages"])))
    assert data["current_stage_id"] is None
    assert data["project_version"] == 1
    assert len({stage["id"] for stage in data["stages"]}) == len(data["stages"])
    assert get_collection(client, project["id"]).json()["data"] == data
    with client.factory() as db:
        assert len(db.execute(select(ProjectStage).where(ProjectStage.project_id == project["id"])).all()) == len(data["stages"])


def test_create_replay_seeds_only_once_and_type_change_keeps_edits(client):
    key = uuid4()
    payload = {"name": "Project", "type": "development"}
    first = client.post("/api/v1/projects", headers=headers(key=key), json=payload)
    replay = client.post("/api/v1/projects", headers=headers(key=key), json=payload)
    assert first.json() == replay.json()
    project_id = first.json()["data"]["id"]
    before = get_collection(client, project_id).json()["data"]
    updated = client.patch(
        f"/api/v1/projects/{project_id}", headers=headers(key=uuid4()), json={"type": "pet"},
    )
    assert updated.status_code == 200
    after = get_collection(client, project_id).json()["data"]
    assert after["stages"] == before["stages"]
    assert after["project_version"] == 2


def test_replace_reorder_rename_current_clear_and_empty_preserve_parent_fields(client):
    project = create_project(client)
    path = f"/api/v1/projects/{project['id']}"
    original = get_collection(client, project["id"]).json()["data"]["stages"]
    added = str(uuid4())
    draft = [{"id": original[1]["id"], "name": "  Design  "}, {"id": added, "name": "Launch"}]
    first = put_collection(client, project["id"], draft, added)
    assert first.status_code == 200, first.text
    data = first.json()["data"]
    assert data["stages"] == [
        {"id": original[1]["id"], "name": "Design", "sort_order": 0},
        {"id": added, "name": "Launch", "sort_order": 1},
    ]
    assert data["current_stage_id"] == added
    assert data["project_version"] == 2
    assert get_collection(client, project["id"]).json()["data"] == data
    parent = client.get(path, headers=headers()).json()["data"]
    assert (parent["manual_progress"], parent["status"], parent["next_step"]) == (42, "planning", "Next")
    assert parent["updated_at"] != project["updated_at"]

    cleared = put_collection(client, project["id"], [{"id": added, "name": "Launch"}], None)
    assert cleared.status_code == 200
    assert cleared.json()["data"]["current_stage_id"] is None
    assert cleared.json()["data"]["project_version"] == 3
    empty = put_collection(client, project["id"], [], None)
    assert empty.status_code == 200
    assert empty.json()["data"]["stages"] == []
    assert get_collection(client, project["id"]).json()["data"]["stages"] == []


def test_noop_and_idempotency_replay_conflict(client):
    project = create_project(client)
    original = get_collection(client, project["id"]).json()["data"]
    stages = [{"id": item["id"], "name": f" {item['name']} "} for item in original["stages"]]
    key = uuid4()
    first = put_collection(client, project["id"], stages, key=key)
    replay = put_collection(client, project["id"], stages, key=key)
    assert first.status_code == replay.status_code == 200
    assert first.json() == replay.json()
    assert first.json()["data"] == original
    conflicting = put_collection(client, project["id"], [], key=key)
    assert conflicting.status_code == 409
    assert conflicting.json()["error"]["code"] == "idempotency_key_conflict"
    with client.factory() as db:
        assert len(db.execute(select(IdempotencyKey)).all()) == 2


def test_validation_owner_and_rollback(client):
    mine = create_project(client)
    foreign = create_project(client, alias="partner")
    path = f"/api/v1/projects/{mine['id']}/stages"
    original = get_collection(client, mine["id"]).json()["data"]
    foreign_id = get_collection(client, foreign["id"], "partner").json()["data"]["stages"][0]["id"]
    good = {"id": original["stages"][0]["id"], "name": "Good"}
    invalid = [
        {"stages": [good, good], "current_stage_id": None},
        {"stages": [good], "current_stage_id": str(uuid4())},
        {"stages": [{"id": foreign_id, "name": "Foreign"}], "current_stage_id": None},
        {"stages": [{"id": "bad", "name": "Name"}], "current_stage_id": None},
        {"stages": [{"id": str(uuid4()), "name": "  "}], "current_stage_id": None},
        {"stages": [{"id": str(uuid4()), "name": "x" * 101}], "current_stage_id": None},
        {"stages": [{"id": str(uuid4()), "name": None}], "current_stage_id": None},
        {"stages": [{**good, "sort_order": 0}], "current_stage_id": None},
        {"stages": [good], "current_stage_id": None, "user_id": str(uuid4())},
        {"stages": None, "current_stage_id": None},
        {"stages": [good]},
        {"stages": [good] * 21, "current_stage_id": None},
    ]
    for payload in invalid:
        response = client.put(path, headers=headers(key=uuid4()), json=payload)
        assert response.status_code == 400, (payload, response.text)
        assert response.json()["error"]["code"] == "validation_error"
        assert get_collection(client, mine["id"]).json()["data"] == original
    assert client.put(path, headers=headers(), json={"stages": [], "current_stage_id": None}).json()["error"]["code"] == "idempotency_key_required"
    assert get_collection(client, foreign["id"]).status_code == 404
    assert put_collection(client, foreign["id"], [], alias="me").status_code == 404
    assert get_collection(client, str(uuid4())).status_code == 404
    assert client.get(path).status_code == 401
    with client.factory() as db:
        assert len(db.execute(select(IdempotencyKey)).all()) == 2
        assert len(db.execute(select(Project)).all()) == 2
