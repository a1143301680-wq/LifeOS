import base64
import json
import re
from uuid import UUID

from sqlalchemy import DateTime, and_, func, literal, or_, select, type_coerce
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models.ai_session import AISession
from app.models.project_log import ProjectLog
from app.models.project_todo_link import ProjectTodoLink
from app.models.todo import Todo
from app.schemas.ai_session import as_utc, parse_rfc3339
from app.schemas.project_timeline import TimelineEntry

KINDS = ("manual_log", "ai_session", "todo_completed")


def decode_cursor(raw: str | None, owner: UUID, project: UUID):
    if raw is None:
        return None
    try:
        if not 1 <= len(raw) <= 4096 or not re.fullmatch(r"[A-Za-z0-9_-]+", raw):
            raise ValueError()
        value = json.loads(base64.b64decode(raw + "=" * (-len(raw) % 4), altchars=b"-_", validate=True))
        if not isinstance(value, dict) or set(value) != {"v", "owner_id", "project_id", "anchor"}:
            raise ValueError()
        if type(value["v"]) is not int or value["v"] != 1:
            raise ValueError()
        if not isinstance(value["owner_id"], str) or not isinstance(value["project_id"], str):
            raise ValueError()
        if UUID(value["owner_id"]) != owner or UUID(value["project_id"]) != project:
            raise ValueError()
        anchor = value["anchor"]
        if not isinstance(anchor, dict) or set(anchor) != {"occurred_at", "kind", "source_id"}:
            raise ValueError()
        if not isinstance(anchor["kind"], str) or anchor["kind"] not in KINDS or not isinstance(anchor["source_id"], str):
            raise ValueError()
        return (parse_rfc3339(anchor["occurred_at"]), KINDS.index(anchor["kind"]), UUID(anchor["source_id"]))
    except (ValueError, TypeError, KeyError, UnicodeError, OverflowError, RecursionError) as exc:
        raise ApiError(400, "validation_error", "Invalid timeline cursor") from exc


def encode_cursor(entry: dict, owner: UUID, project: UUID) -> str:
    value = {"v": 1, "owner_id": str(owner), "project_id": str(project), "anchor": {
        "occurred_at": entry["occurred_at"], "kind": entry["kind"], "source_id": entry["source_id"],
    }}
    return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).decode().rstrip("=")


def timeline_page(db: Session, owner: UUID, project: UUID, limit: int, raw_cursor: str | None):
    anchor = decode_cursor(raw_cursor, owner, project)
    completed = Todo.completed_at
    if db.bind.dialect.name == "sqlite":
        # Existing Todo writes use Shanghai wall time; SQLite drops its offset. Keep microseconds when converting.
        completed = type_coerce(func.datetime(func.substr(Todo.completed_at, 1, 19), "-8 hours").concat(func.substr(Todo.completed_at, 20)), DateTime())
    sources = (
        (ProjectLog, ProjectLog.created_at, ProjectLog.title, ProjectLog.content,
         select(ProjectLog).where(ProjectLog.user_id == owner, ProjectLog.project_id == project, ProjectLog.deleted_at.is_(None))),
        (AISession, AISession.started_at, AISession.goal, AISession.completed_work,
         select(AISession).where(AISession.user_id == owner, AISession.project_id == project)),
        (Todo, completed, Todo.title, literal(None),
         select(Todo).join(ProjectTodoLink, ProjectTodoLink.todo_id == Todo.id).where(
             ProjectTodoLink.user_id == owner, ProjectTodoLink.project_id == project, Todo.user_id == owner,
             Todo.deleted_at.is_(None), Todo.status == "completed", Todo.completed_at.is_not(None), completed >= ProjectTodoLink.created_at)),
    )
    found = []
    for rank, (model, occurred, title, summary, query) in enumerate(sources):
        query = query.with_only_columns(model.id, occurred.label("occurred"), title.label("title"), summary.label("summary"), model.version)
        if anchor is not None:
            time, anchor_rank, source_id = anchor
            after_tie = literal(rank) > anchor_rank if rank != anchor_rank else model.id > source_id
            query = query.where(or_(occurred < time, and_(occurred == time, after_tie)))
        for row in db.execute(query.order_by(occurred.desc(), model.id.asc()).limit(limit + 1)):
            time = as_utc(row.occurred)
            preview = (row.summary or "").strip()
            entry = TimelineEntry(kind=KINDS[rank], source_id=row.id, occurred_at=time, title=row.title,
                                  summary=preview[:300] or None, source_version=row.version).model_dump(mode="json")
            found.append((time, rank, row.id, entry))
    found.sort(key=lambda item: (item[1], item[2]))
    found.sort(key=lambda item: item[0], reverse=True)
    entries = [item[3] for item in found[:limit]]
    cursor = encode_cursor(entries[-1], owner, project) if len(found) > limit else None
    return entries, cursor
