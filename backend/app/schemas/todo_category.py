from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TodoCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=32)
    icon: str | None = Field(default=None, max_length=64)
    sort_order: int | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TodoCategoryRead(BaseModel):
    id: UUID
    name: str
    color: str | None
    icon: str | None
    is_inbox: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
