from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

TimelineKind = Literal["manual_log", "ai_session", "todo_completed"]


class TimelineEntry(BaseModel):
    kind: TimelineKind
    source_id: UUID
    occurred_at: datetime
    title: str
    summary: str | None
    source_version: int
