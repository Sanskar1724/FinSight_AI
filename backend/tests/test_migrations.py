from __future__ import annotations

from pathlib import Path

import pytest
from alembic import command
from sqlalchemy import create_engine, inspect, text

from app.core.config import settings
from app.db import migrate


@pytest.fixture()
def file_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    url = f"sqlite:///{(tmp_path / 'legacy.db').as_posix()}"
    engine = create_engine(url)
    monkeypatch.setattr(settings, "database_url", url)
    monkeypatch.setattr(migrate, "engine", engine)
    yield engine
    engine.dispose()


def test_fresh_database_upgrades_to_head(file_database) -> None:
    migrate.upgrade_database()
    columns = {c["name"] for c in inspect(file_database).get_columns("users")}
    assert "token_version" in columns


def test_legacy_create_all_database_gains_new_columns(file_database) -> None:
    # Simulate a database created before Alembic was tracked: initial schema only,
    # with no alembic_version table.
    command.upgrade(migrate._alembic_config(), migrate.INITIAL_REVISION)
    with file_database.begin() as connection:
        connection.execute(text("DROP TABLE alembic_version"))
        connection.execute(
            text(
                "INSERT INTO users (email, name, password_hash, is_demo, timezone, created_at) "
                "VALUES ('old@example.com', 'Old User', 'x', 0, 'Asia/Kolkata', CURRENT_TIMESTAMP)"
            )
        )

    migrate.upgrade_database()

    columns = {c["name"] for c in inspect(file_database).get_columns("users")}
    assert "token_version" in columns
    with file_database.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM users")).scalar() == 1
        version = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert version == migrate.TOKEN_VERSION_REVISION
