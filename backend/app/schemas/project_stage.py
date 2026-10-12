from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class StagePut(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=100)

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class StageCollectionPut(BaseModel):
    stages: list[StagePut] = Field(max_length=20)
    current_stage_id: UUID | None

    model_config = ConfigDict(extra="forbid")
