from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.rate_limit import auth_rate_limiter
from app.db.base import Base, get_db
from app.main import app
from app.seed import seed_reference_data

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(
    bind=TEST_ENGINE, autoflush=False, autocommit=False, expire_on_commit=False
)


@pytest.fixture(autouse=True)
def reset_auth_rate_limiter() -> Iterator[None]:
    auth_rate_limiter.reset()
    yield
    auth_rate_limiter.reset()


@pytest.fixture(autouse=True)
def database(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)
    with TestingSession() as db:
        seed_reference_data(db)
        db.commit()
    monkeypatch.setattr("app.services.research.SessionLocal", TestingSession)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


def _override_get_db() -> Iterator[Session]:
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client() -> Iterator[TestClient]:
    app.dependency_overrides[get_db] = _override_get_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        test_client.close()
        app.dependency_overrides.clear()


@pytest.fixture()
def db() -> Iterator[Session]:
    with TestingSession() as session:
        yield session


def signup(
    client: TestClient,
    *,
    email: str = "alice@example.com",
    name: str = "Alice Sharma",
    password: str = "StrongPass123",
) -> dict:
    response = client.post(
        "/api/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    return response.json()


def category_id(client: TestClient, slug: str) -> int:
    response = client.get("/api/categories")
    assert response.status_code == 200
    return next(item["id"] for item in response.json() if item["slug"] == slug)


def create_transaction(
    client: TestClient,
    *,
    slug: str = "food-dining",
    amount: str = "500.00",
    occurred_on: str | None = None,
    merchant: str = "Test Merchant",
    txn_type: str = "expense",
):
    from datetime import date

    return client.post(
        "/api/transactions",
        json={
            "type": txn_type,
            "amount": amount,
            "occurred_on": occurred_on or date.today().isoformat(),
            "category_id": category_id(client, slug),
            "merchant": merchant,
            "payment_method": "UPI",
        },
    )
