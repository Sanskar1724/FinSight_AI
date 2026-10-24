"""Bring the database schema up to date with Alembic on startup.

Earlier releases created tables with ``Base.metadata.create_all`` and never
recorded an Alembic revision, so later migrations (for example
``users.token_version``) were never applied to existing databases. This module
detects such legacy databases, stamps them at the revision their schema already
matches, and then upgrades to head.
"""

from __future__ import annotations

import logging

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.core.config import BACKEND_DIR
from app.db.base import engine

logger = logging.getLogger(__name__)

INITIAL_REVISION = "11f3cd1f2f87"
TOKEN_VERSION_REVISION = "9b1d2f4a7c10"


def _alembic_config() -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    # Keep the application's logging configuration intact.
    config.attributes["configure_logger"] = False
    return config


def _legacy_revision() -> str | None:
    """Return the revision a pre-Alembic database already matches, if any."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "alembic_version" in tables or "users" not in tables:
        return None
    columns = {column["name"] for column in inspector.get_columns("users")}
    return TOKEN_VERSION_REVISION if "token_version" in columns else INITIAL_REVISION


def upgrade_database() -> None:
    config = _alembic_config()
    legacy = _legacy_revision()
    if legacy is not None:
        logger.info("Stamping legacy database at revision %s before upgrading", legacy)
        command.stamp(config, legacy)
    command.upgrade(config, "head")
