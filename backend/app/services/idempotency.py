import hashlib
import json
from datetime import timedelta
from urllib.parse import urlencode
from uuid import UUID

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.time import now_server
from app.models.idempotency import IdempotencyKey


def canonical_json_body(body: object | None) -> str:
    if body is None or body == b"":
        return ""
    if isinstance(body, bytes):
        body = json.loads(body.decode("utf-8"))
    return json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_query(request: Request) -> str:
    pairs = sorted(request.query_params.multi_items(), key=lambda item: (item[0], item[1]))
    return urlencode(pairs)


def request_fingerprint(
    method: str,
    normalized_path: str,
    query: str = "",
    json_body: object | None = None,
) -> str:
    raw = "\n".join(
        [
            method.upper(),
            normalized_path,
            query,
            canonical_json_body(json_body),
        ]
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def require_idempotency_key(raw_key: str | None) -> UUID:
    if raw_key is None or raw_key.strip() == "":
        raise ApiError(400, "idempotency_key_required", "Idempotency-Key header is required")

    try:
        return UUID(raw_key)
    except ValueError as exc:
        raise ApiError(400, "validation_error", "Idempotency-Key must be a UUID") from exc


def find_idempotency_record(
    db: Session,
    *,
    user_id: UUID,
    key: UUID,
    request_hash: str,
) -> IdempotencyKey | None:
    record = db.execute(
        select(IdempotencyKey).where(
            IdempotencyKey.user_id == user_id,
            IdempotencyKey.key == key,
        )
    ).scalar_one_or_none()
    if record is None:
        return None
    if record.request_hash != request_hash:
        raise ApiError(
            409,
            "idempotency_key_conflict",
            "Idempotency-Key was already used for a different request",
        )
    return record


def store_idempotency_response(
    db: Session,
    *,
    user_id: UUID,
    key: UUID,
    method: str,
    path: str,
    request_hash: str,
    response_status: int,
    response_body: dict,
) -> IdempotencyKey:
    record = IdempotencyKey(
        user_id=user_id,
        key=key,
        method=method.upper(),
        path=path,
        request_hash=request_hash,
        response_status=response_status,
        response_body=response_body,
        expires_at=now_server() + timedelta(days=7),
    )
    db.add(record)
    return record


async def get_idempotency_context(
    db: Session,
    *,
    request: Request,
    user_id: UUID,
    raw_key: str | None,
) -> tuple[UUID, str, JSONResponse | None]:
    key = require_idempotency_key(raw_key)
    body = await request.body()
    request_hash = request_fingerprint(
        request.method,
        request.url.path,
        canonical_query(request),
        body,
    )
    existing = find_idempotency_record(
        db,
        user_id=user_id,
        key=key,
        request_hash=request_hash,
    )
    if existing is None:
        return key, request_hash, None
    return key, request_hash, JSONResponse(
        status_code=existing.response_status,
        content=existing.response_body,
    )
