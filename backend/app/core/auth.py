from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError, VerificationError
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import ApiError
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)
password_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1)


def verify_bootstrap_token(token: str, token_hash: str) -> bool:
    try:
        return password_hasher.verify(token_hash, token)
    except (InvalidHashError, VerificationError, VerifyMismatchError):
        return False


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ApiError(401, "unauthorized", "missing or invalid bearer token")

    token = credentials.credentials.strip()
    if not token:
        raise ApiError(401, "unauthorized", "missing or invalid bearer token")

    users = db.execute(select(User)).scalars().all()
    for user in users:
        if verify_bootstrap_token(token, user.bootstrap_token_hash):
            return user

    raise ApiError(401, "unauthorized", "missing or invalid bearer token")
