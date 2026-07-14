from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class Todo(Base):
    __tablename__ = "todos"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'completed', 'canceled')",
            name="ck_todos_status",
        ),
        CheckConstraint(
            "priority IN ('high', 'medium', 'low')",
            name="ck_todos_priority",
        ),
        Index("ix_todos_user_status_planned_date", "user_id", "status", "planned_date"),
        Index("ix_todos_user_due_at", "user_id", "due_at"),
        Index("ix_todos_user_category_id", "user_id", "category_id"),
        Index("ix_todos_user_updated_at", "user_id", "updated_at"),
        Index("ix_todos_recurring_template_generated_date", "recurring_template_id", "generated_for_date"),
    )

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(
        GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[str | None] = mapped_column(
        GUID(), ForeignKey("todo_categories.id", ondelete="SET NULL"), nullable=True
    )
    recurring_template_id: Mapped[str | None] = mapped_column(GUID(), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    planned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    generated_for_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    source_client_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    client_created_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
