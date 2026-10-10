from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class AISession(Base):
    __tablename__ = "ai_sessions"
    __table_args__ = (
        CheckConstraint("length(goal) BETWEEN 1 AND 500", name="ck_ai_sessions_goal_length"),
        CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ck_ai_sessions_time_order"),
        Index("ix_ai_sessions_user_project_started_id", "user_id", "project_id", "started_at", "id"),
    )

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[str] = mapped_column(GUID(), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    goal: Mapped[str] = mapped_column(String(500), nullable=False)
    completed_work: Mapped[str | None] = mapped_column(String(4000))
    modified_files: Mapped[str | None] = mapped_column(String(4000))
    verification_result: Mapped[str | None] = mapped_column(String(4000))
    remaining_issues: Mapped[str | None] = mapped_column(String(4000))
    next_step: Mapped[str | None] = mapped_column(String(4000))
    recommended_next_prompt: Mapped[str | None] = mapped_column(String(4000))
    ai_tool: Mapped[str | None] = mapped_column(String(100))
    user_note: Mapped[str | None] = mapped_column(String(4000))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
