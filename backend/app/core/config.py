from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_SECRET_KEY = "local-development-secret-change-in-production-please"
MIN_PRODUCTION_SECRET_LENGTH = 32


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
    secret_key: str = DEFAULT_SECRET_KEY
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
    # Restore the public demo account to its seeded data every night (03:00 in
    # TIMEZONE) so visitors always see a clean workspace.
    demo_nightly_reset: bool = True
    enable_scheduler: bool = True
    # Interactive API docs are on in development and off in production unless
    # explicitly enabled, so the full API surface is not advertised publicly.
    enable_api_docs: bool | None = None
    notification_check_minutes: int = 30
    max_upload_bytes: int = 2_000_000
    # Public URL of the web app, used in links inside emails.
    public_app_url: str = "http://localhost:5173"
    # Contact shown on the Privacy Policy and Terms pages for data requests.
    support_email: str = ""
    # Outgoing email (password reset). When SMTP_HOST is empty, emails are
    # written to the log instead of being sent, which suits local development.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    mail_from: str = "FinSight AI <no-reply@finsight.local>"
    password_reset_minutes: int = 30
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

    @model_validator(mode="after")
    def _require_strong_secret_in_production(self) -> "Settings":
        # The default key is public in the repository; anyone could forge sessions.
        if self.is_production and (
            self.secret_key in {DEFAULT_SECRET_KEY, "replace-with-a-long-random-value"}
            or len(self.secret_key) < MIN_PRODUCTION_SECRET_LENGTH
        ):
            raise ValueError(
                "SECRET_KEY must be set to a random value of at least "
                f"{MIN_PRODUCTION_SECRET_LENGTH} characters when ENVIRONMENT=production. "
                'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def api_docs_enabled(self) -> bool:
        if self.enable_api_docs is not None:
            return self.enable_api_docs
        return not self.is_production

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")

    @property
    def use_secure_cookies(self) -> bool:
        return self.cookie_secure or self.is_production


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
