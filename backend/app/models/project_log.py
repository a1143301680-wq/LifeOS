from datetime import datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class ProjectLog(Base):
    __tablename__ = "project_logs"
    __table_args__ = (
        CheckConstraint("length(trim(title)) BETWEEN 1 AND 200", name="ck_project_logs_title_length"),
        CheckConstraint("content IS NULL OR length(content) <= 4000", name="ck_project_logs_content_length"),
        CheckConstraint("version > 0", name="ck_project_logs_version"),
        Index("ix_project_logs_owner_project_deleted_created_id", "user_id", "project_id", "deleted_at", "created_at", "id"),
    )

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[str] = mapped_column(GUID(), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(String(4000))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
