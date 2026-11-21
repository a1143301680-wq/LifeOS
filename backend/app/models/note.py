from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class Note(Base):
    __tablename__ = "notes"
    __table_args__ = (
        CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="ck_notes_title"),
        CheckConstraint("length(content) <= 10000", name="ck_notes_content"),
        CheckConstraint("length(external_url) <= 2048", name="ck_notes_external_url"),
        CheckConstraint("version > 0", name="ck_notes_version"),
    )

    id: Mapped[UUID] = mapped_column(GUID(), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"))
    project_id: Mapped[UUID | None] = mapped_column(GUID(), ForeignKey("projects.id", ondelete="SET NULL"))
    todo_id: Mapped[UUID | None] = mapped_column(GUID(), ForeignKey("todos.id", ondelete="SET NULL"))
    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str | None] = mapped_column(String(10000))
    external_url: Mapped[str | None] = mapped_column(String(2048))
    version: Mapped[int] = mapped_column(Integer, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


Index("ix_notes_owner_updated", Note.user_id, Note.deleted_at, Note.updated_at.desc(), Note.id)
Index("ix_notes_owner_project_updated", Note.user_id, Note.project_id, Note.deleted_at, Note.updated_at.desc(), Note.id)
Index("ix_notes_owner_todo_updated", Note.user_id, Note.todo_id, Note.deleted_at, Note.updated_at.desc(), Note.id)
