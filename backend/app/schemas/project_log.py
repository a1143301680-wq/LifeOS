from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.ai_session import as_utc


class ProjectLogCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str | None = Field(default=None, max_length=4000)
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("content", mode="before")
    @classmethod
    def normalize_content(cls, value):
        return value.strip() or None if isinstance(value, str) else value


class ProjectLogPatch(ProjectLogCreate):
    title: str | None = Field(default=None, min_length=1, max_length=200)

    @field_validator("title", mode="before")
    @classmethod
    def non_null_title(cls, value):
        if value is None:
            raise ValueError("title cannot be null")
        return value

    @model_validator(mode="after")
    def nonempty_patch(self):
        if not self.model_fields_set:
            raise ValueError("at least one field is required")
        return self


class ProjectLogRead(BaseModel):
    id: UUID
    title: str
    content: str | None
    version: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_time(cls, value):
        return as_utc(value)
