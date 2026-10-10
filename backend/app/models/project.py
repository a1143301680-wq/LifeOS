from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 200", name="ck_projects_name_length"),
        CheckConstraint("type IN ('development', 'learning', 'life', 'health', 'pet', 'other')", name="ck_projects_type"),
        CheckConstraint("status IN ('planning', 'in_progress', 'paused', 'completed', 'abandoned')", name="ck_projects_status"),
        CheckConstraint("manual_progress BETWEEN 0 AND 100", name="ck_projects_progress"),
        Index("ix_projects_user_pin_updated_id", "user_id", "is_pinned", "updated_at", "id"),
    )

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    type: Mapped[str] = mapped_column(String(32), nullable=False, default="other", server_default=text("'other'"))
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="planning", server_default=text("'planning'"))
    manual_progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    next_step: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
