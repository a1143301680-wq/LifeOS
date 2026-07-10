from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import GUID


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(GUID(), primary_key=True, default=uuid4)
    alias: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    bootstrap_token_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Shanghai")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
