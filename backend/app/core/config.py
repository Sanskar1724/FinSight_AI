from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Environment-driven configuration.

    Defaults are safe for local development: SQLite storage and a deterministic
    AI provider that requires no API key.
    """

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "FinSight AI"
    environment: str = "development"
    api_prefix: str = "/api"
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'finsight.db').as_posix()}"
    secret_key: str = "local-development-secret-change-in-production-please"
    access_token_expire_minutes: int = 60 * 24 * 7
    cookie_name: str = "finsight_session"
    cookie_secure: bool = False
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    auth_rate_limit_attempts: int = 20
    auth_rate_limit_window_seconds: int = 300
    demo_email: str = "demo@finsight.local"
    demo_password: str = "Demo@12345"
    demo_name: str = "Aarav Mehta"
    timezone: str = "Asia/Kolkata"
    auto_create_tables: bool = True
    seed_demo_on_startup: bool = True
    enable_scheduler: bool = True
    notification_check_minutes: int = 30
    max_upload_bytes: int = 2_000_000
    ai_provider: str = "deterministic"
    ai_base_url: str = "https://api.openai.com/v1"
    ai_api_key: str = ""
    ai_model: str = "gpt-4o-mini"
    ai_timeout_seconds: float = 30.0
    ai_max_context_chars: int = 6000
    ai_rate_limit_per_hour: int = 40
    research_max_cases: int = 60
    prompt_version: str = "chat-v1"
    research_prompt_version: str = "research-v1"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")

    @property
    def use_secure_cookies(self) -> bool:
        return self.cookie_secure or self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
