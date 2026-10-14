import re
from datetime import date, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


MilestoneStatus = Literal["pending", "completed", "canceled"]


class MilestonePut(BaseModel):
    id: UUID
    title: str = Field(min_length=1, max_length=200)
    target_date: date | None
    status: MilestoneStatus

    model_config = ConfigDict(extra="forbid")

    @field_validator("title", mode="before")
    @classmethod
    def trim_title(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("target_date", mode="before")
    @classmethod
    def exact_calendar_date(cls, value: Any) -> date | None:
        if value is None:
            return None
        if not isinstance(value, str) or re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value) is None:
            raise ValueError("target_date must be YYYY-MM-DD or null")
        return date.fromisoformat(value)


class MilestoneCollectionPut(BaseModel):
    milestones: list[MilestonePut] = Field(max_length=50)

    model_config = ConfigDict(extra="forbid")


class MilestoneRead(BaseModel):
    id: UUID
    title: str
    target_date: date | None
    status: MilestoneStatus
    sort_order: int
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
