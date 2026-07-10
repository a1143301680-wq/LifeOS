from typing import Any

from app.core.time import server_time_iso


def data_envelope(data: Any, sync: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"data": data}
    if sync is not None:
        body["sync"] = sync
    body["server_time"] = server_time_iso()
    return body


def list_envelope(
    items: list[Any],
    next_cursor: str | int | None = None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {"items": items, "server_time": server_time_iso()}
    if next_cursor is not None:
        body["next_cursor"] = next_cursor
    if extra:
        body.update(extra)
    return body


def error_envelope(
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        },
        "server_time": server_time_iso(),
    }
