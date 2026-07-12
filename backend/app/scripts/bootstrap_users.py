import secrets
from uuid import uuid4

from argon2 import PasswordHasher
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.user import User
from app.services.default_categories import seed_default_categories_for_all_users

password_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1)


def ensure_user(db: Session, alias: str, display_name: str) -> str | None:
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
    return raw_token


def bootstrap_seed_data(db: Session) -> dict[str, str | None]:
    created_tokens = {
        "me": ensure_user(db, "me", "Me"),
        "partner": ensure_user(db, "partner", "Partner"),
    }
    db.flush()
    seed_default_categories_for_all_users(db)
    db.commit()
    return created_tokens


def main() -> None:
    with SessionLocal() as db:
        created = bootstrap_seed_data(db)

    for alias, token in created.items():
        if token is None:
            print(f"{alias}: already exists; token was not rotated")
        else:
            print(f"{alias}: {token}")


if __name__ == "__main__":
    main()
