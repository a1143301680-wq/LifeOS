import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


RFC3339 = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")
OPTIONAL_TEXT = (
    "completed_work", "modified_files", "verification_result", "remaining_issues",
    "next_step", "recommended_next_prompt", "ai_tool", "user_note",
)


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def parse_rfc3339(value: Any) -> datetime:
    if not isinstance(value, str) or not RFC3339.fullmatch(value):
        raise ValueError("timestamp must be timezone-aware RFC 3339")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("invalid RFC 3339 timestamp") from exc
    return as_utc(parsed)


class AISessionFields(BaseModel):
    goal: str = Field(min_length=1, max_length=500)
    completed_work: str | None = Field(default=None, max_length=4000)
    modified_files: str | None = Field(default=None, max_length=4000)
    verification_result: str | None = Field(default=None, max_length=4000)
    remaining_issues: str | None = Field(default=None, max_length=4000)
    next_step: str | None = Field(default=None, max_length=4000)
    recommended_next_prompt: str | None = Field(default=None, max_length=4000)
    ai_tool: str | None = Field(default=None, max_length=100)
    user_note: str | None = Field(default=None, max_length=4000)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    ended_at: datetime | None = None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator(*OPTIONAL_TEXT, mode="before")
    @classmethod
    def empty_optional_text(cls, value: Any) -> Any:
        return value.strip() or None if isinstance(value, str) else value

    @field_validator("started_at", mode="before")
    @classmethod
    def parse_start(cls, value: Any) -> datetime:
        return parse_rfc3339(value)

    @field_validator("ended_at", mode="before")
    @classmethod
    def parse_end(cls, value: Any) -> datetime | None:
        return None if value is None else parse_rfc3339(value)


class AISessionCreate(AISessionFields):
    @model_validator(mode="after")
    def valid_range(self):
        if self.ended_at is not None and self.ended_at < self.started_at:
            raise ValueError("ended_at must be at or after started_at")
        return self


class AISessionUpdate(AISessionFields):
    goal: str | None = Field(default=None, min_length=1, max_length=500)
    started_at: datetime | None = None

    @field_validator("goal", "started_at", mode="before")
    @classmethod
    def reject_null_required_fields(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("field cannot be null")
        return value


class AISessionRead(BaseModel):
    id: UUID
    goal: str
    completed_work: str | None
    modified_files: str | None
    verification_result: str | None
    remaining_issues: str | None
    next_step: str | None
    recommended_next_prompt: str | None
    ai_tool: str | None
    user_note: str | None
    started_at: datetime
    ended_at: datetime | None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("started_at", "ended_at", "created_at", "updated_at", mode="before")
    @classmethod
    def normalize_output_time(cls, value: datetime | None) -> datetime | None:
        return None if value is None else as_utc(value)
