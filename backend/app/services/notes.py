import base64
import json
import re
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models.note import Note
from app.models.project import Project
from app.models.todo import Todo


def timestamp(value: datetime) -> str:
    return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)).isoformat()


def owned_note(db: Session, owner: UUID, note_id: UUID, *, lock: bool = False) -> Note:
    query = select(Note).where(Note.user_id == owner, Note.id == note_id, Note.deleted_at.is_(None))
    note = db.scalar(query.with_for_update() if lock else query)
    if note is None:
        raise ApiError(404, "not_found", "Note not found")
    return note


def validate_sources(db: Session, owner: UUID, changes: dict):
    for field, model in (("project_id", Project), ("todo_id", Todo)):
        if (ident := changes.get(field)) is not None:
            query = select(model.id).where(model.id == ident, model.user_id == owner, model.deleted_at.is_(None))
            if db.scalar(query.with_for_update(read=True)) is None:
                raise ApiError(404, "not_found", "Note source not found")


def project_notes(db: Session, owner: UUID, notes: list[Note]) -> list[dict]:
    def labels(model, field, label):
        ids = {ident for note in notes if (ident := getattr(note, field)) is not None}
        if not ids:
            return {}
        query = select(model.id, label).where(model.id.in_(ids), model.user_id == owner, model.deleted_at.is_(None))
        return dict(db.execute(query).tuples().all())

    projects = labels(Project, "project_id", Project.name)
    todos = labels(Todo, "todo_id", Todo.title)

    def reference(ident, available):
        return None if ident is None else {"id": str(ident), "label": available.get(ident), "available": ident in available}

    return [{
        "id": str(note.id), "title": note.title, "content": note.content,
        "project": reference(note.project_id, projects), "todo": reference(note.todo_id, todos),
        "external_url": note.external_url, "version": note.version,
        "created_at": timestamp(note.created_at), "updated_at": timestamp(note.updated_at),
    } for note in notes]


def list_notes(db: Session, owner: UUID, project_id: UUID | None, todo_id: UUID | None, limit: int, cursor: str | None):
    binding = [str(owner), str(project_id) if project_id else None, str(todo_id) if todo_id else None]
    query = select(Note).where(Note.user_id == owner, Note.deleted_at.is_(None))
    if project_id is not None:
        query = query.where(Note.project_id == project_id)
    if todo_id is not None:
        query = query.where(Note.todo_id == todo_id)
    if cursor is not None:
        try:
            if len(cursor) > 2048 or not re.fullmatch(r"[A-Za-z0-9_-]+", cursor):
                raise ValueError()
            raw = base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
            version, filters, when, ident = json.loads(raw)
            if type(version) is not int or version != 1 or filters != binding:
                raise ValueError()
            anchor = datetime.fromisoformat(when)
            if anchor.tzinfo is None:
                raise ValueError()
            anchor = anchor.astimezone(timezone.utc)
            ident = UUID(ident)
        except (ValueError, TypeError, AttributeError, OverflowError, RecursionError) as exc:
            raise ApiError(400, "validation_error", "Invalid Notes cursor") from exc
        query = query.where(or_(Note.updated_at < anchor, and_(Note.updated_at == anchor, Note.id > ident)))
    rows = list(db.scalars(query.order_by(Note.updated_at.desc(), Note.id).limit(limit + 1)))
    next_cursor = None
    if len(rows) > limit:
        anchor = rows[limit - 1]
        data = json.dumps([1, binding, timestamp(anchor.updated_at), str(anchor.id)], separators=(",", ":"))
        next_cursor = base64.urlsafe_b64encode(data.encode()).decode().rstrip("=")
    return project_notes(db, owner, rows[:limit]), next_cursor
