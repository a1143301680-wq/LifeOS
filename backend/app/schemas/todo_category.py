from datetime import datetime
from uuid import UUID

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TodoCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=32)
    icon: str | None = Field(default=None, max_length=64)
    sort_order: int | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class TodoCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, max_length=32)
    icon: str | None = Field(default=None, max_length=64)
    sort_order: int | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("name", "sort_order", mode="before")
    @classmethod
    def reject_null_for_required_update_fields(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("field cannot be null")
        return value


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
