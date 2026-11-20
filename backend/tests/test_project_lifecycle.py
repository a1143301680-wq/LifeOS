from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.idempotency import IdempotencyKey
from app.models.project import Project
from test_project_stages import client, create_project, headers
from test_project_todo_links import sources_and_sync


def action(client, route, suffix, key=None, alias="me"):
    return client.request("POST" if suffix else "DELETE", route + suffix, headers=headers(alias, key or uuid4()))


def test_lifecycle_visibility_versions_and_replay(client):
    project = create_project(client)
    route = f"/api/v1/projects/{project['id']}"
    create_project(client, alias="partner")
    assert action(client, route, "").json()["error"]["code"] == "project_not_archived"
    assert action(client, route, "/restore").json()["data"] == project
    assert action(client, route, "/archive", alias="partner").status_code == 404
    assert client.post(route + "/archive", headers=headers()).json()["error"]["code"] == "idempotency_key_required"
    assert client.post(route + "/archive", headers=headers(key=uuid4()), json={}).status_code == 400
    assert client.get("/api/v1/projects?scope=deleted", headers=headers()).status_code == 400
    key = uuid4()
    archived = action(client, route, "/archive", key)
    data = archived.json()["data"]
    assert data["archived_at"] and data["version"] == 2 and data["manual_progress"] == project["manual_progress"]
    assert action(client, route, "/archive", key).json() == archived.json()
    assert action(client, route, "/archive").json()["data"] == data
    assert action(client, route, "/restore", key).status_code == 409
    assert client.get("/api/v1/projects", headers=headers()).json()["items"] == []
    assert client.get("/api/v1/projects?scope=archived", headers=headers()).json()["items"] == [data]
    assert client.get("/api/v1/projects?scope=archived", headers=headers("partner")).json()["items"] == []
    assert client.get(route, headers=headers()).json()["data"] == data
    restored = action(client, route, "/restore").json()["data"]
    assert restored["archived_at"] is None and restored["version"] == 3
    assert action(client, route, "/archive").status_code == 200
    key = uuid4()
    deleted = action(client, route, "", key)
    assert set(deleted.json()["data"]) == {"id", "deleted", "deleted_at", "version"}
    assert deleted.json()["data"]["version"] == 5
    assert action(client, route, "", key).json() == deleted.json()
    assert action(client, route, "/restore").status_code == 404
    assert client.get("/api/v1/projects?scope=archived", headers=headers()).json()["items"] == []


def test_deleted_parent_blocks_fresh_child_reads_and_writes_and_preserves_replay(client):
    route = f"/api/v1/projects/{create_project(client)['id']}"
    assert action(client, route, "/archive").status_code == 200
    session_key = uuid4()
    session = client.post(route + "/ai-sessions", headers=headers(key=session_key), json={"goal": "Saved"})
    log = client.post(route + "/logs", headers=headers(key=uuid4()), json={"title": "Saved"})
    assert session.status_code == log.status_code == 201
    session_route = "/ai-sessions/" + session.json()["data"]["id"]
    log_route = "/logs/" + log.json()["data"]["id"]
    before = sources_and_sync(client)
    assert action(client, route, "").status_code == 200
    for suffix in ("", "/stages", "/milestones", "/todo-links", "/timeline", "/ai-sessions", session_route, log_route):
        assert client.get(route + suffix, headers=headers()).status_code == 404
    for method, suffix, payload in (
        ("PATCH", "", {"name": "Gone"}),
        ("PUT", "/stages", {"stages": [], "current_stage_id": None}),
        ("PUT", "/milestones", {"milestones": []}),
        ("PUT", "/todo-links", {"todo_ids": []}),
        ("POST", "/ai-sessions", {"goal": "Gone"}),
        ("PATCH", session_route, {"goal": "Gone"}),
        ("POST", "/logs", {"title": "Gone"}),
        ("PATCH", log_route, {"title": "Gone"}),
        ("DELETE", log_route, None),
    ):
        assert client.request(method, route + suffix, headers=headers(key=uuid4()), json=payload).status_code == 404
    assert client.post(route + "/ai-sessions", headers=headers(key=session_key), json={"goal": "Saved"}).json() == session.json()
    assert sources_and_sync(client) == before


def test_idempotency_storage_failure_rolls_back_archive(client, monkeypatch):
    project = create_project(client)
    route = f"/api/v1/projects/{project['id']}"
    key = uuid4()

    def fail(*args, **kwargs):
        raise RuntimeError("synthetic storage failure")

    monkeypatch.setattr("app.api.v1.projects.store_idempotency_response", fail)
    with pytest.raises(RuntimeError):
        action(client, route, "/archive", key)
    assert client.get(route, headers=headers()).json()["data"] == project
    with client.factory() as db:
        assert db.execute(select(IdempotencyKey).where(IdempotencyKey.key == key)).first() is None
        assert db.execute(select(Project)).scalar_one().archived_at is None
