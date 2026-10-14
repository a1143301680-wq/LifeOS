from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.models.idempotency import IdempotencyKey
from app.models.milestone import Milestone
from test_project_stages import client, create_project, headers


def row(title="Target", target_date=None, status="pending", id=None):
    return {"id": id or str(uuid4()), "title": title, "target_date": target_date, "status": status}


def path(project):
    return f"/api/v1/projects/{project['id']}/milestones"


def get(client, project):
    response = client.get(path(project), headers=headers())
    assert response.status_code == 200
    return response.json()["data"]


def put(client, project, rows, key=None, alias="me"):
    return client.put(path(project), headers=headers(alias, key or uuid4()), json={"milestones": rows})


def writable(data):
    return [{key: item[key] for key in ("id", "title", "target_date", "status")} for item in data["milestones"]]


def test_empty_no_seed_and_type_changes_preserve_collection(client):
    project = create_project(client)
    assert get(client, project) == {"milestones": [], "project_version": 1}
    saved = put(client, project, [row()]).json()["data"]
    client.patch(f"/api/v1/projects/{project['id']}", headers=headers(key=uuid4()), json={"type": "pet"})
    assert get(client, project)["milestones"] == saved["milestones"]
    with client.factory() as db:
        assert len(db.execute(select(Milestone)).all()) == 1


def test_row_parent_versions_noop_reorder_and_soft_removal(client):
    project = create_project(client)
    first = put(client, project, [row(" First ", "2028-02-29"), row("Second", status="canceled")]).json()["data"]
    assert first["project_version"] == 2
    assert [item["version"] for item in first["milestones"]] == [1, 1]
    assert first["milestones"][0]["title"] == "First"
    assert first["milestones"][0]["target_date"] == "2028-02-29"
    normalized = writable(first)
    normalized[0]["title"] = "  First  "
    before_parent = client.get(f"/api/v1/projects/{project['id']}", headers=headers()).json()["data"]
    assert put(client, project, normalized).json()["data"] == first
    assert client.get(f"/api/v1/projects/{project['id']}", headers=headers()).json()["data"] == before_parent
    changed = writable(first)
    changed[0].update(target_date=None, status="completed")
    second = put(client, project, changed).json()["data"]
    assert second["project_version"] == 3
    assert second["milestones"][0]["version"] == 2
    assert second["milestones"][0]["created_at"] == first["milestones"][0]["created_at"]
    assert second["milestones"][1] == first["milestones"][1]
    reordered = put(client, project, list(reversed(writable(second)))).json()["data"]
    assert [item["version"] for item in reordered["milestones"]] == [2, 3]
    assert [item["sort_order"] for item in reordered["milestones"]] == [0, 1]
    removed = reordered["milestones"][0]
    last = put(client, project, writable(reordered)[1:]).json()["data"]
    assert last["project_version"] == 5
    with client.factory() as db:
        tombstone = db.get(Milestone, UUID(removed["id"]))
        assert tombstone.deleted_at is not None
        assert tombstone.updated_at == tombstone.deleted_at
        assert tombstone.version == removed["version"] + 1
        assert (tombstone.title, tombstone.status, tombstone.sort_order) == (removed["title"], removed["status"], removed["sort_order"])
    assert put(client, project, writable(reordered)).status_code == 400
    empty = put(client, project, []).json()["data"]
    assert empty["project_version"] == 6 and empty["milestones"] == []
    assert put(client, project, []).json()["data"] == empty
    parent = client.get(f"/api/v1/projects/{project['id']}", headers=headers()).json()["data"]
    assert (parent["manual_progress"], parent["status"], parent["next_step"]) == (42, "planning", "Next")


@pytest.mark.parametrize("status", ["pending", "completed", "canceled"])
def test_every_status_can_transition_to_every_other_status(client, status):
    project = create_project(client)
    item = row(status=status)
    for target in ("pending", "completed", "canceled"):
        item["status"] = target
        response = put(client, project, [item])
        assert response.status_code == 200
        assert response.json()["data"]["milestones"][0]["status"] == target


@pytest.mark.parametrize("date", ["2028-02-29", "0001-01-01", "9999-12-31", "2000-02-29", None])
def test_exact_valid_calendar_dates(client, date):
    project = create_project(client)
    response = put(client, project, [row(target_date=date)])
    assert response.status_code == 200
    assert response.json()["data"]["milestones"][0]["target_date"] == date


@pytest.mark.parametrize("date", ["2026-02-29", "1900-02-29", "2026-04-31", "2026-1-01", "20260101", "2026-01-01T00:00:00Z", " 2026-01-01", "0000-01-01", 0, True, [], {}])
def test_invalid_dates_leave_state_and_idempotency_unchanged(client, date):
    project = create_project(client)
    response = put(client, project, [row(target_date=date)])
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
    assert get(client, project)["milestones"] == []
    with client.factory() as db:
        assert len(db.execute(select(IdempotencyKey)).all()) == 1


def test_validation_bounds_and_failed_requests_are_atomic(client):
    project = create_project(client)
    original = put(client, project, [row()]).json()["data"]
    good = writable(original)[0]
    invalid = [{}, {"milestones": None}, {"milestones": [None]}, {"milestones": [good], "user_id": str(uuid4())}]
    for field in ("id", "title", "target_date", "status"):
        missing = dict(good)
        del missing[field]
        invalid.append({"milestones": [missing]})
    for field, value in [("id", None), ("id", "bad"), ("title", None), ("title", " "), ("title", "x" * 201), ("status", None), ("status", "done"), ("sort_order", 1), ("version", 9), ("deleted_at", None), ("project_id", project["id"])]:
        invalid.append({"milestones": [{**good, field: value}]})
    invalid.extend([{"milestones": [good, good]}, {"milestones": [row() for _ in range(51)]}])
    for payload in invalid:
        response = client.put(path(project), headers=headers(key=uuid4()), json=payload)
        assert response.status_code == 400, (payload, response.text)
        assert get(client, project) == original
    max_rows = put(client, project, [row("x" * 200) for _ in range(50)])
    assert max_rows.status_code == 200
    assert len(max_rows.json()["data"]["milestones"]) == 50


def test_owner_id_collision_and_auth(client):
    mine = create_project(client)
    other = create_project(client, alias="partner")
    same_owner_other = create_project(client)
    foreign_row = row()
    assert put(client, other, [foreign_row], alias="partner").status_code == 200
    assert put(client, mine, [foreign_row]).status_code == 400
    assert put(client, same_owner_other, [foreign_row]).status_code == 400
    assert client.get(path(other), headers=headers()).status_code == 404
    assert put(client, other, []).status_code == 404
    assert client.get(path(mine)).status_code == 401
    assert client.put(path(mine), json={"milestones": []}).status_code == 401
    assert client.get(f"/api/v1/projects/{uuid4()}/milestones", headers=headers()).status_code == 404


def test_idempotency_replay_conflict_missing_and_rollback_on_store_error(client, monkeypatch):
    project = create_project(client)
    key = uuid4()
    rows = [row()]
    first = put(client, project, rows, key)
    replay = put(client, project, rows, key)
    assert first.status_code == replay.status_code == 200
    assert first.json() == replay.json()
    assert put(client, project, [], key).status_code == 409
    assert client.put(path(project), headers=headers(), json={"milestones": []}).json()["error"]["code"] == "idempotency_key_required"
    before = get(client, project)

    def fail(*args, **kwargs):
        raise RuntimeError("synthetic storage failure")

    monkeypatch.setattr("app.api.v1.project_milestones.store_idempotency_response", fail)
    with pytest.raises(RuntimeError):
        put(client, project, [])
    assert get(client, project) == before
    with client.factory() as db:
        assert len(db.execute(select(IdempotencyKey)).all()) == 2
        assert db.execute(select(Milestone)).scalar_one().deleted_at is None
