import hashlib
import json
from urllib.parse import urlencode

from fastapi import Request


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
