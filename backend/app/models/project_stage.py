from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class ProjectStage(Base):
    __tablename__ = "project_stages"
    __table_args__ = (
        CheckConstraint("length(name) BETWEEN 1 AND 100", name="ck_project_stages_name_length"),
        CheckConstraint("sort_order >= 0", name="ck_project_stages_sort_order"),
        Index("ix_project_stages_project_order", "project_id", "sort_order", "id"),
        Index(
            "uq_project_stages_current_project", "project_id", unique=True,
            postgresql_where=text("is_current"), sqlite_where=text("is_current = 1"),
        ),
    )

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[str] = mapped_column(GUID(), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
