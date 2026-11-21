from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, TypeAdapter, field_validator, model_validator

http_url = TypeAdapter(HttpUrl)


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    content: str | None = Field(default=None, max_length=10000)
    project_id: UUID | None = None
    todo_id: UUID | None = None
    external_url: str | None = Field(default=None, max_length=2048)

    @field_validator("title", "content", "external_url")
    @classmethod
    def reject_nul(cls, value):
        if value is not None and "\x00" in value:
            raise ValueError("Text cannot contain NUL")
        return value

    @field_validator("content", "external_url")
    @classmethod
    def normalize_blank(cls, value):
        return value or None

    @field_validator("external_url")
    @classmethod
    def validate_url(cls, value):
        if value is None:
            return None
        parsed = urlsplit(value)
        if (parsed.scheme not in {"http", "https"} or not parsed.hostname or "@" in parsed.netloc
                or "\\" in value or any(char.isspace() or ord(char) < 32 or ord(char) == 127 for char in value)):
            raise ValueError("Use an absolute HTTP(S) URL without credentials")
        http_url.validate_python(value)
        return value


class NotePatch(NoteCreate):
    title: str | None = Field(default=None, min_length=1, max_length=200)

    @model_validator(mode="after")
    def validate_patch(self):
        if not self.model_fields_set or ("title" in self.model_fields_set and self.title is None):
            raise ValueError("Provide at least one field and a non-null title")
        return self
