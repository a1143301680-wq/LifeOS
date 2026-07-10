from uuid import uuid4

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.main import create_app
from app.models.user import User


@pytest.fixture()
def client(tmp_path):
    database_path = tmp_path / "lifeos-test.db"
    engine = create_engine(f"sqlite:///{database_path}", future=True)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    token = "test-token-for-me"
    hasher = PasswordHasher(time_cost=1, memory_cost=1024, parallelism=1)
    with TestingSessionLocal() as db:
        db.add(
            User(
                id=uuid4(),
                alias="me",
                display_name="Me",
                bootstrap_token_hash=hasher.hash(token),
                timezone="Asia/Shanghai",
            )
        )
        db.commit()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        test_client.identity_token = token
        yield test_client


def test_get_me_returns_current_user_envelope(client):
    response = client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {client.identity_token}"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["alias"] == "me"
    assert body["data"]["display_name"] == "Me"
    assert body["data"]["timezone"] == "Asia/Shanghai"
    assert "id" in body["data"]
    assert "server_time" in body
    assert "user_id" not in body["data"]


def test_get_me_rejects_missing_token_with_error_envelope(client):
    response = client.get("/api/v1/me")

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "unauthorized"
    assert "server_time" in body


def test_get_me_rejects_invalid_token_with_error_envelope(client):
    response = client.get(
        "/api/v1/me",
        headers={"Authorization": "Bearer wrong-token"},
    )

    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "unauthorized"
    assert "server_time" in body
