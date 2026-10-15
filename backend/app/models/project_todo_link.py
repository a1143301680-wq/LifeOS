from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class ProjectTodoLink(Base):
    __tablename__ = "project_todo_links"
    __table_args__ = (
        CheckConstraint("sort_order >= 0", name="ck_project_todo_links_sort_order"),
        Index("ix_project_todo_links_user_project_order", "user_id", "project_id", "sort_order", "todo_id"),
    )

    project_id: Mapped[str] = mapped_column(GUID(), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    todo_id: Mapped[str] = mapped_column(GUID(), ForeignKey("todos.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
