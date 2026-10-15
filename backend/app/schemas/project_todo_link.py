from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectTodoLinksPut(BaseModel):
    todo_ids: list[UUID] = Field(max_length=50)

    model_config = ConfigDict(extra="forbid")


class LinkedTodoRead(BaseModel):
    id: UUID
    title: str
    status: str
    priority: str
    planned_date: date | None
    due_at: datetime | None
    version: int

    model_config = ConfigDict(from_attributes=True)
