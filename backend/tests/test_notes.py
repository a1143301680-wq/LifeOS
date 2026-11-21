from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from sqlalchemy import select

from app.models.note import Note
from app.models.todo import Todo
from app.models.user import User
from test_project_stages import client, create_project, headers
from test_project_todo_links import sources_and_sync

PATH = "/api/v1/notes"


def write(client, method, path=PATH, payload=None, key=None, alias="me"):
    return client.request(method, path, headers=headers(alias, key or uuid4()),
                          **({"json": payload} if payload is not None else {}))


def test_note_lifecycle_owner_sources_and_replay(client):
    project = create_project(client)["id"]
    foreign = create_project(client, alias="partner")["id"]
    todo_id, foreign_todo_id = uuid4(), uuid4()
    with client.factory.begin() as db:
        user = db.scalar(select(User).where(User.alias == "me"))
        partner = db.scalar(select(User).where(User.alias == "partner"))
        db.add(Todo(id=todo_id, user_id=user.id, title="Linked Todo", status="completed"))
        db.add(Todo(id=foreign_todo_id, user_id=partner.id, title="Foreign Todo"))
    project_path = f"/api/v1/projects/{project}"
    assert write(client, "POST", project_path + "/archive").status_code == 200
    original = sources_and_sync(client)
    key = uuid4()
    payload = {"title": " Note ", "content": " Body ", "project_id": project,
               "todo_id": str(todo_id), "external_url": " https://example.test/wiki "}
    reply = write(client, "POST", payload=payload, key=key)
    assert reply.status_code == 201
    data = reply.json()["data"]
    assert data["title"] == "Note" and data["content"] == "Body"
    assert data["todo"] == {"id": str(todo_id), "label": "Linked Todo", "available": True}
    assert data["project"]["available"] and data["external_url"] == "https://example.test/wiki"
    assert write(client, "POST", payload=payload, key=key).json() == reply.json()
    assert write(client, "POST", payload={"title": "X"}, key=key).status_code == 409
    path = PATH + "/" + data["id"]
    assert client.get(path).status_code == 401
    assert client.get(path, headers=headers("partner")).status_code == 404
    assert write(client, "PATCH", path, {"title": "X"}, alias="partner").status_code == 404
    assert write(client, "DELETE", path, alias="partner").status_code == 404
    assert write(client, "PATCH", path, {"project_id": foreign}).status_code == 404
    assert write(client, "PATCH", path, {"todo_id": str(foreign_todo_id)}).status_code == 404
    assert write(client, "PATCH", path, {"title": " Note "}).json()["data"] == data
    assert client.get(PATH, headers=headers(), params={"project_id": project, "todo_id": todo_id}).json()["items"] == [data]
    assert client.get(PATH, headers=headers(), params={"project_id": foreign}).json()["items"] == []
    assert sources_and_sync(client) == original
    assert write(client, "DELETE", project_path).status_code == 200
    assert write(client, "POST", payload={"title": "Gone", "project_id": project}).status_code == 404
    unavailable = write(client, "PATCH", path, {"title": "Edited", "project_id": project}).json()["data"]
    assert unavailable["version"] == 2 and unavailable["project"] == {"id": project, "label": None, "available": False}
    assert client.get(PATH, headers=headers(), params={"project_id": project}).json()["items"] == [unavailable]
    cleared = write(client, "PATCH", path, {"project_id": None, "content": " "}).json()["data"]
    assert cleared["project"] is cleared["content"] is None and cleared["todo"] == data["todo"]
    with client.factory.begin() as db:
        db.get(Todo, todo_id).deleted_at = datetime.now(timezone.utc)
    assert write(client, "POST", payload={"title": "Gone", "todo_id": str(todo_id)}).status_code == 404
    retained = client.get(path, headers=headers()).json()["data"]
    assert retained["todo"] == {"id": str(todo_id), "label": None, "available": False}
    assert client.get(PATH, headers=headers(), params={"todo_id": todo_id}).json()["items"] == [retained]
    cleared = write(client, "PATCH", path, {"todo_id": None, "project_id": None}).json()["data"]
    assert cleared["todo"] is cleared["project"] is None
    delete_key = uuid4()
    deleted = write(client, "DELETE", path, key=delete_key)
    assert deleted.json()["data"]["version"] == 5
    assert write(client, "DELETE", path, key=delete_key).json() == deleted.json()
    assert write(client, "DELETE", path).status_code == 404
    assert client.get(path, headers=headers()).status_code == 404


@pytest.mark.parametrize("payload", [
    {"title": " "}, {"title": "😀" * 201}, {"title": "a", "content": "x" * 10001},
    {"title": "a", "user_id": "x"}, {"title": "a", "project_id": "x"},
    *({"title": "a", "external_url": url} for url in (
        "javascript:alert(1)", "//example.test", "https:///example.test", "http://u:p@example.test",
        "https://@example.test", "https://example.test\\@elsewhere.test", "https://exam ple.test",
        "https://example.test:" + "9" * 10, "https://example.test/" + "x" * 2048,
    )),
])
def test_note_validation(client, payload):
    response = write(client, "POST", payload=payload)
    assert response.status_code == 400 and response.json()["error"]["code"] == "validation_error"


def test_cursor_ties_binding_and_patch_validation(client):
    rows = [write(client, "POST", payload={"title": str(i)}).json()["data"] for i in range(3)]
    with client.factory.begin() as db:
        first = db.get(Note, UUID(rows[0]["id"]))
        for row in rows[1:]:
            db.get(Note, UUID(row["id"])).updated_at = first.updated_at
    page = client.get(PATH, headers=headers(), params={"limit": 1}).json()
    cursor = page["next_cursor"]
    rest = client.get(PATH, headers=headers(), params={"cursor": cursor, "limit": 2}).json()
    assert [item["id"] for item in page["items"] + rest["items"]] == sorted(row["id"] for row in rows)
    assert "next_cursor" not in rest
    assert client.get(PATH, headers=headers("partner"), params={"cursor": cursor}).status_code == 400
    assert client.get(PATH, headers=headers(), params={"cursor": cursor, "todo_id": uuid4()}).status_code == 400
    for bad in ("", "!!!", "A" * 2049):
        assert client.get(PATH, headers=headers(), params={"cursor": bad}).status_code == 400
    path = PATH + "/" + rows[0]["id"]
    for payload in ({}, {"title": None}, {"todo_id": "invalid"}):
        assert write(client, "PATCH", path, payload).status_code == 400
    assert write(client, "DELETE", path, {}).status_code == 400
    assert client.post(PATH, json={"title": "Key"}, headers=headers()).json()["error"]["code"] == "idempotency_key_required"
