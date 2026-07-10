from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LifeOS API"
    environment: str = "development"
    database_url: str = Field(
        default="postgresql+psycopg://lifeos:lifeos@localhost:5432/lifeos",
        validation_alias="DATABASE_URL",
    )
    cors_origins: list[str] = Field(default_factory=list)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
