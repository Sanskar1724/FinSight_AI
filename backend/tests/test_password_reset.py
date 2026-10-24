from __future__ import annotations

from collections.abc import Iterator
from datetime import timedelta
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.base import utcnow
from app.models import PasswordResetToken
from app.services import email as email_service
from tests.conftest import TestingSession, signup


@pytest.fixture(autouse=True)
def empty_outbox() -> Iterator[None]:
    email_service.outbox.clear()
    yield
    email_service.outbox.clear()


def _request_reset(client: TestClient, address: str = "alice@example.com") -> str | None:
    response = client.post("/api/auth/forgot-password", json={"email": address})
    assert response.status_code == 200
    if not email_service.outbox:
        return None
    link = next(line for line in email_service.outbox[-1].text.splitlines() if "token=" in line)
    return parse_qs(urlparse(link.strip()).query)["token"][0]


def test_unknown_email_gets_the_same_response_and_no_email(client: TestClient) -> None:
    signup(client)
    known = client.post("/api/auth/forgot-password", json={"email": "alice@example.com"})
    email_service.outbox.clear()
    unknown = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert unknown.status_code == known.status_code == 200
    assert unknown.json() == known.json()
    assert email_service.outbox == []


def test_reset_link_changes_password_once_and_revokes_sessions(client: TestClient) -> None:
    signup(client)
    assert client.get("/api/auth/me").status_code == 200
    token = _request_reset(client, "ALICE@example.com ")
    assert token is not None
    assert email_service.outbox[-1].to == "alice@example.com"

    reset = client.post("/api/auth/reset-password", json={"token": token, "password": "BrandNew123"})
    assert reset.status_code == 200, reset.text

    # The session issued before the reset no longer works.
    assert client.get("/api/auth/me").status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "StrongPass123"}
    ).status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "BrandNew123"}
    ).status_code == 200

    # The link is single-use.
    again = client.post("/api/auth/reset-password", json={"token": token, "password": "Another123"})
    assert again.status_code == 400


def test_only_the_latest_link_works(client: TestClient) -> None:
    signup(client)
    first = _request_reset(client)
    second = _request_reset(client)
    assert first and second and first != second
    assert client.post(
        "/api/auth/reset-password", json={"token": first, "password": "BrandNew123"}
    ).status_code == 400
    assert client.post(
        "/api/auth/reset-password", json={"token": second, "password": "BrandNew123"}
    ).status_code == 200


def test_expired_link_is_rejected(client: TestClient) -> None:
    signup(client)
    token = _request_reset(client)
    with TestingSession() as db:
        record = db.scalar(select(PasswordResetToken))
        record.expires_at = utcnow() - timedelta(minutes=1)
        db.commit()
    response = client.post("/api/auth/reset-password", json={"token": token, "password": "BrandNew123"})
    assert response.status_code == 400


def test_token_is_stored_hashed_and_demo_account_cannot_reset(client: TestClient) -> None:
    signup(client)
    token = _request_reset(client)
    with TestingSession() as db:
        stored = db.scalar(select(PasswordResetToken.token_hash))
    assert stored and token not in stored and len(stored) == 64

    email_service.outbox.clear()
    client.post("/api/auth/demo")
    assert _request_reset(client, "demo@finsight.local") is None
