from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TodoCreate(BaseModel):
    id: UUID | None = None
    title: str = Field(min_length=1, max_length=500)
    note: str | None = None
    category_id: UUID | None = None
    priority: str = "medium"
    planned_date: date | None = None
    due_at: datetime | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("title")
    @classmethod
    def reject_blank_title(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("title is required")
        return value.strip()

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, value: str) -> str:
        if value not in {"high", "medium", "low"}:
            raise ValueError("priority must be high, medium, or low")
        return value


class TodoCategorySummary(BaseModel):
    id: UUID
    name: str
    is_deleted: bool


class TodoRead(BaseModel):
    id: UUID
    category_id: UUID | None
    category: TodoCategorySummary | None
    title: str
    note: str | None
    status: str
    priority: str
    planned_date: date | None
    due_at: datetime | None
    completed_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    note: str | None = None
    category_id: UUID | None = None
    priority: str | None = None
    planned_date: date | None = None
    due_at: datetime | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("title", mode="before")
    @classmethod
    def reject_null_title(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("title cannot be null")
        return value

    @field_validator("title")
    @classmethod
    def reject_blank_update_title(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("title is required")
        return value.strip()

    @field_validator("priority", mode="before")
    @classmethod
    def reject_null_priority(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("priority cannot be null")
        return value

    @field_validator("priority")
    @classmethod
    def validate_update_priority(cls, value: str) -> str:
        if value not in {"high", "medium", "low"}:
            raise ValueError("priority must be high, medium, or low")
        return value
