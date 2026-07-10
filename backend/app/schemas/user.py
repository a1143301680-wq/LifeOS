from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    id: UUID
    alias: str
    display_name: str
    timezone: str

    model_config = ConfigDict(from_attributes=True)
