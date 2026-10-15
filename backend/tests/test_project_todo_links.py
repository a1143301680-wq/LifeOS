from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.core.time import now_server
from app.models.idempotency import IdempotencyKey
from app.models.project_todo_link import ProjectTodoLink
from app.models.sync import SyncChange
from app.models.todo import Todo
from app.models.user import User
from test_project_stages import client, create_project, headers


def seed_todos(client, statuses=("pending", "completed", "canceled"), alias="me"):
    ids = [uuid4() for _ in statuses]
    with client.factory() as db:
        owner = db.execute(select(User.id).where(User.alias == alias)).scalar_one()
        db.add_all([Todo(id=id, user_id=owner, title=f"Todo {index}", note="Private source note", status=status, priority="medium") for index, (id, status) in enumerate(zip(ids, statuses))])
        db.commit()
    return [str(id) for id in ids]


def path(project):
    return f"/api/v1/projects/{project['id']}/todo-links"


def get(client, project):
    return client.get(path(project), headers=headers()).json()["data"]


def put(client, project, ids, key=None, alias="me"):
    return client.put(path(project), headers=headers(alias, key or uuid4()), json={"todo_ids": ids})


def sources_and_sync(client):
    with client.factory() as db:
        return (list(db.execute(Todo.__table__.select().order_by(Todo.id)).mappings()), list(db.execute(SyncChange.__table__.select()).mappings()))


def test_empty_many_to_many_projection_and_no_todo_sync_mutation(client):
    first, second = create_project(client), create_project(client)
    ids = seed_todos(client)
    before = sources_and_sync(client)
    assert get(client, first) == {"links": [], "project_version": 1}
    saved = put(client, first, ids).json()["data"]
    assert saved["project_version"] == 2
    assert [link["todo_id"] for link in saved["links"]] == ids
    assert [link["todo"]["status"] for link in saved["links"]] == ["pending", "completed", "canceled"]
    assert set(saved["links"][0]["todo"]) == {"id", "title", "status", "priority", "planned_date", "due_at", "version"}
    assert put(client, second, [ids[0]]).status_code == 200
    assert put(client, first, []).status_code == 200
    assert get(client, second)["links"][0]["todo_id"] == ids[0]
    assert sources_and_sync(client) == before
    assert put(client, first, [ids[0]]).status_code == 200


def test_noop_reorder_creation_time_replay_and_conflict(client):
    project = create_project(client)
    ids = seed_todos(client)
    key = uuid4()
    first = put(client, project, ids, key)
    assert first.json() == put(client, project, ids, key).json()
    assert put(client, project, [], key).status_code == 409
    parent_path = f"/api/v1/projects/{project['id']}"
    parent = client.get(parent_path, headers=headers()).json()["data"]
    with client.factory() as db:
        times = {row.todo_id: row.created_at for row in db.execute(select(ProjectTodoLink)).scalars()}
    assert put(client, project, ids).json()["data"] == first.json()["data"]
    assert client.get(parent_path, headers=headers()).json()["data"] == parent
    reordered = put(client, project, list(reversed(ids))).json()["data"]
    assert reordered["project_version"] == 3
    assert [row["sort_order"] for row in reordered["links"]] == [0, 1, 2]
    with client.factory() as db:
        assert {row.todo_id: row.created_at for row in db.execute(select(ProjectTodoLink)).scalars()} == times


def test_current_source_edits_deletion_and_unavailable_retention(client):
    project = create_project(client)
    ids = seed_todos(client)
    put(client, project, ids)
    with client.factory() as db:
        todo = db.get(Todo, UUID(ids[0]))
        todo.title = "Current title"
        todo.version += 1
        db.get(Todo, UUID(ids[1])).deleted_at = now_server()
        db.commit()
    data = get(client, project)
    assert data["project_version"] == 2
    assert data["links"][0]["todo"]["title"] == "Current title"
    assert data["links"][1] == {"todo_id": ids[1], "sort_order": 1, "unavailable": True, "todo": None}
    assert put(client, project, [ids[1], ids[0]]).status_code == 200
    assert put(client, project, [ids[0]]).status_code == 200
    assert put(client, project, [ids[1], ids[0]]).status_code == 400
    # A corrupted/inaccessible retained source must fail closed on read, without exposing its content.
    with client.factory() as db:
        partner = db.execute(select(User.id).where(User.alias == "partner")).scalar_one()
        db.get(Todo, UUID(ids[0])).user_id = partner
        db.commit()
    assert get(client, project)["links"][0]["todo"] is None
    assert get(client, project)["links"][0]["unavailable"] is True


@pytest.mark.parametrize("payload", [{}, {"todo_ids": None}, {"todo_ids": [None]}, {"todo_ids": ["bad"]}, {"todo_ids": [], "user_id": "bad"}, {"todo_ids": [], "sort_order": 0}, {"todo_ids": [str(uuid4()) for _ in range(51)]}])
def test_invalid_shapes(client, payload):
    project = create_project(client)
    response = client.put(path(project), headers=headers(key=uuid4()), json=payload)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"
    assert get(client, project) == {"links": [], "project_version": 1}


def test_foreign_missing_deleted_duplicate_additions_are_atomic(client):
    project = create_project(client)
    own = seed_todos(client)
    foreign = seed_todos(client, ("pending",), alias="partner")[0]
    with client.factory() as db:
        db.get(Todo, UUID(own[2])).deleted_at = now_server()
        db.commit()
    before = sources_and_sync(client)
    original = put(client, project, [own[0]]).json()["data"]
    for ids in ([own[0], foreign], [own[0], str(uuid4())], [own[0], own[2]], [own[0], own[0]]):
        response = put(client, project, ids)
        assert response.status_code == 400
        assert get(client, project) == original
    assert sources_and_sync(client) == before
    assert client.get(path(project)).status_code == 401
    assert client.get(path(project), headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.get(path(project), headers=headers("partner")).status_code == 404
    assert put(client, project, [], alias="partner").status_code == 404
    assert client.get(f"/api/v1/projects/{uuid4()}/todo-links", headers=headers()).status_code == 404
    assert client.put(path(project), headers=headers(), json={"todo_ids": []}).json()["error"]["code"] == "idempotency_key_required"
    with client.factory() as db:
        assert len(db.execute(select(IdempotencyKey)).all()) == 2


def test_maximum_clear_and_failed_store_roll_back_links_and_parent(client, monkeypatch):
    project = create_project(client)
    ids = seed_todos(client, ["pending"] * 50)
    saved = put(client, project, ids).json()["data"]
    assert len(saved["links"]) == 50

    def fail(*args, **kwargs):
        raise RuntimeError("synthetic idempotency storage failure")

    monkeypatch.setattr("app.api.v1.project_todo_links.store_idempotency_response", fail)
    with pytest.raises(RuntimeError):
        put(client, project, [])
    assert get(client, project) == saved
