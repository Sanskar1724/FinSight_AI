from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import DEFAULT_SECRET_KEY, Settings


def test_production_rejects_default_secret() -> None:
    with pytest.raises(ValidationError, match="SECRET_KEY"):
        Settings(_env_file=None, environment="production", secret_key=DEFAULT_SECRET_KEY)


def test_production_rejects_example_and_short_secrets() -> None:
    for weak in ("replace-with-a-long-random-value", "short-secret"):
        with pytest.raises(ValidationError, match="SECRET_KEY"):
            Settings(_env_file=None, environment="production", secret_key=weak)


def test_production_accepts_strong_secret_and_forces_secure_cookies() -> None:
    settings = Settings(_env_file=None, environment="production", secret_key="x" * 48)
    assert settings.is_production
    assert settings.use_secure_cookies


def test_development_keeps_the_convenient_default() -> None:
    settings = Settings(_env_file=None, environment="development")
    assert settings.secret_key == DEFAULT_SECRET_KEY
    assert not settings.use_secure_cookies
