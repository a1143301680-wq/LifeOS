from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


ProjectType = Literal["development", "learning", "life", "health", "pet", "other"]
ProjectStatus = Literal["planning", "in_progress", "paused", "completed", "abandoned"]


class ProjectFields(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    type: ProjectType = "other"
    status: ProjectStatus = "planning"
    manual_progress: int = Field(default=0, ge=0, le=100, strict=True)
    next_step: str | None = Field(default=None, max_length=1000)
    is_pinned: bool = False

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("description", "next_step", mode="before")
    @classmethod
    def empty_optional_text(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip() or None
        return value


class ProjectCreate(ProjectFields):
    pass


class ProjectUpdate(ProjectFields):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    type: ProjectType | None = None
    status: ProjectStatus | None = None
    manual_progress: int | None = Field(default=None, ge=0, le=100, strict=True)
    is_pinned: bool | None = None

    @field_validator("name", "type", "status", "manual_progress", "is_pinned", mode="before")
    @classmethod
    def reject_null_required_fields(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("field cannot be null")
        return value


class ProjectRead(BaseModel):
    id: UUID
    name: str
    description: str | None
    type: ProjectType
    status: ProjectStatus
    manual_progress: int
    next_step: str | None
    is_pinned: bool
    version: int
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None

    @field_validator("archived_at")
    @classmethod
    def normalize_archived_at(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    model_config = ConfigDict(from_attributes=True)
