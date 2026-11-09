from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models.project_log import ProjectLog
from app.models.idempotency import IdempotencyKey

from test_project_stages import client, create_project, headers
from test_project_todo_links import sources_and_sync


def log_path(project):
    return f"/api/v1/projects/{project['id']}/logs"


def write(client, method, path, payload=None, key=None, alias="me"):
    return client.request(method, path, headers=headers(alias, key or uuid4()), **({"json": payload} if payload is not None else {}))


def parent(client, project):
    return client.get(f"/api/v1/projects/{project['id']}", headers=headers()).json()["data"]


def test_manual_log_lifecycle_noop_and_replay(client):
    project = create_project(client)
    path = log_path(project)
    sources_before = sources_and_sync(client)
    key = uuid4()
    created = write(client, "POST", path, {"title": " Record ", "content": " Details "}, key)
    assert created.status_code == 201
    assert write(client, "POST", path, {"content": " Details ", "title": " Record "}, key).json() == created.json()
    log = created.json()["data"]
    assert set(log) == {"id", "title", "content", "version", "created_at", "updated_at"}
    assert log["title"] == "Record" and log["content"] == "Details" and log["version"] == 1
    detail = f"{path}/{log['id']}"
    old_parent = parent(client, project)
    assert old_parent["version"] == 2
    assert write(client, "PATCH", detail, {"title": " Record "}).json()["data"] == log
    assert parent(client, project) == old_parent
    edited = write(client, "PATCH", detail, {"content": " "}).json()["data"]
    assert edited["content"] is None and edited["version"] == 2
    assert edited["created_at"] == log["created_at"]
    key = uuid4()
    deleted = write(client, "DELETE", detail, key=key)
    assert deleted.status_code == 200 and deleted.json()["data"]["version"] == 3
    assert write(client, "DELETE", detail, key=key).json() == deleted.json()
    assert write(client, "DELETE", detail).status_code == 410
    assert client.get(detail, headers=headers()).status_code == 410
    assert write(client, "PATCH", detail, {"title": "no"}).status_code == 410
    assert parent(client, project)["version"] == 4
    assert sources_and_sync(client) == sources_before


@pytest.mark.parametrize("payload", [{}, {"title": None}, {"title": " "}, {"title": "a" * 201}, {"title": 1}, {"title": "ok", "content": 42}, {"title": "ok", "content": "a" * 4001}, {"title": "ok", "user_id": "x"}, {"title": "ok", "created_at": "2020-01-01"}])
def test_invalid_create_is_atomic(client, payload):
    project = create_project(client)
    assert write(client, "POST", log_path(project), payload).status_code == 400
    assert parent(client, project)["version"] == 1
    with client.factory() as db:
        assert db.execute(select(ProjectLog)).first() is None


def test_validation_isolation_keys_and_history(client):
    project, other = create_project(client), create_project(client)
    route = log_path(project)
    assert client.post(route, headers=headers(), json={"title": "ok"}).json()["error"]["code"] == "idempotency_key_required"
    key = uuid4()
    created = write(client, "POST", route, {"title": "ok"}, key).json()["data"]
    assert write(client, "POST", route, {"title": "changed"}, key).status_code == 409
    detail = f"{route}/{created['id']}"
    for payload in ({}, {"title": None}, {"title": " "}, {"content": []}, {"kind": "manual_log"}, {"version": 1}):
        assert write(client, "PATCH", detail, payload).status_code == 400
    assert client.get(detail).status_code == 401
    assert client.get(detail, headers=headers("partner")).status_code == 404
    assert write(client, "PATCH", detail, {"title": "foreign"}, alias="partner").status_code == 404
    assert write(client, "POST", route, {"title": "foreign"}, alias="partner").status_code == 404
    assert client.get(f"{log_path(other)}/{created['id']}", headers=headers()).status_code == 404
    assert client.get(f"{route}/{uuid4()}", headers=headers()).status_code == 404
    assert write(client, "DELETE", detail, {}).status_code == 400
    assert client.get(detail, headers=headers()).json()["data"] == created
    assert write(client, "DELETE", detail).status_code == 200
    with client.factory() as db:
        row = db.execute(select(ProjectLog)).scalar_one()
        assert row.title == "ok" and row.deleted_at is not None
        assert len(db.execute(select(IdempotencyKey)).all()) == 4


def test_failed_idempotency_storage_rolls_back_every_mutation(client, monkeypatch):
    project = create_project(client)
    route = log_path(project)
    log = write(client, "POST", route, {"title": "kept"}).json()["data"]
    old = parent(client, project)

    def fail(*args, **kwargs):
        raise RuntimeError("synthetic storage failure")

    monkeypatch.setattr("app.api.v1.project_logs.store_idempotency_response", fail)
    for method, path, payload in (("POST", route, {"title": "lost"}), ("PATCH", f"{route}/{log['id']}", {"title": "lost"}), ("DELETE", f"{route}/{log['id']}", None)):
        with pytest.raises(RuntimeError):
            write(client, method, path, payload)
        assert parent(client, project) == old
        assert client.get(f"{route}/{log['id']}", headers=headers()).json()["data"] == log
