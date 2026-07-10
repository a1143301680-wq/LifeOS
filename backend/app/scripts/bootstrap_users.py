import secrets
from uuid import uuid4

from argon2 import PasswordHasher
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.user import User

password_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1)


def ensure_user(alias: str, display_name: str) -> str | None:
    with SessionLocal() as db:
        existing = db.execute(select(User).where(User.alias == alias)).scalar_one_or_none()
        if existing is not None:
            return None

        raw_token = secrets.token_urlsafe(48)
        db.add(
            User(
                id=uuid4(),
                alias=alias,
                display_name=display_name,
                bootstrap_token_hash=password_hasher.hash(raw_token),
                timezone="Asia/Shanghai",
            )
        )
        db.commit()
        return raw_token


def main() -> None:
    created = {
        "me": ensure_user("me", "Me"),
        "partner": ensure_user("partner", "Partner"),
    }
    for alias, token in created.items():
        if token is None:
            print(f"{alias}: already exists; token was not rotated")
        else:
            print(f"{alias}: {token}")


if __name__ == "__main__":
    main()
