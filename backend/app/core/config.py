from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LifeOS API"
    environment: str = "development"
    database_url: str = Field(
        default="postgresql+psycopg://lifeos:lifeos@localhost:5432/lifeos",
        validation_alias="DATABASE_URL",
    )
    cors_origins: list[str] = Field(default_factory=list)
    deepseek_api_key: SecretStr | None = Field(default=None, validation_alias="DEEPSEEK_API_KEY")
    deepseek_base_url: str = Field(
        default="https://api.deepseek.com",
        validation_alias="DEEPSEEK_BASE_URL",
    )
    deepseek_model: str = Field(default="deepseek-flash", validation_alias="DEEPSEEK_MODEL")
    ai_request_timeout_seconds: int = Field(
        default=30,
        ge=5,
        le=60,
        validation_alias="AI_REQUEST_TIMEOUT_SECONDS",
    )
    ai_max_output_tokens: int = Field(
        default=1200,
        ge=256,
        le=2000,
        validation_alias="AI_MAX_OUTPUT_TOKENS",
    )
    ai_context_todo_limit: int = Field(
        default=50,
        ge=1,
        le=100,
        validation_alias="AI_CONTEXT_TODO_LIMIT",
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
