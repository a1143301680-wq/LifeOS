from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class AITodayPlanRequest(BaseModel):
    date: date

    model_config = ConfigDict(extra="forbid")


class AIFocusItem(BaseModel):
    todo_id: UUID
    reason: str = Field(min_length=1, max_length=300)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AIRisk(BaseModel):
    todo_id: UUID | None = None
    message: str = Field(min_length=1, max_length=300)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class AISuggestedTodo(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    priority: Literal["high", "medium", "low"]
    planned_date: date
    category_id: UUID | None = None
    reason: str = Field(min_length=1, max_length=300)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @field_validator("title")
    @classmethod
    def reject_blank_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("title is required")
        return value.strip()


class AIProviderPlan(BaseModel):
    summary: str = Field(min_length=1, max_length=600)
    focus_items: list[AIFocusItem] = Field(max_length=3)
    risks: list[AIRisk] = Field(max_length=3)
    suggested_todo: AISuggestedTodo | None

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    @model_validator(mode="after")
    def reject_duplicate_references(self):
        references = [item.todo_id for item in self.focus_items]
        references.extend(risk.todo_id for risk in self.risks if risk.todo_id is not None)
        if len(references) != len(set(references)):
            raise ValueError("todo references must be unique")
        return self


class AIUsage(BaseModel):
    model: str
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    total_tokens: int | None = Field(default=None, ge=0)


class AITodayPlanRead(AIProviderPlan):
    date: date
    usage: AIUsage
