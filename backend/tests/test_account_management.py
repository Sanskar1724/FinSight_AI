from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select, text

from app.main import app
from app.models import User
from tests.conftest import TEST_ENGINE, TestingSession, category_id, create_transaction, signup


def _second_device(client: TestClient) -> TestClient:
    other = TestClient(app)
    other.cookies.update(client.cookies)
    return other


def test_change_password_keeps_this_device_and_signs_out_others(client: TestClient) -> None:
    signup(client)
    other = _second_device(client)
    assert other.get("/api/auth/me").status_code == 200

    wrong = client.post(
        "/api/auth/change-password",
        json={"current_password": "not-it", "new_password": "BrandNew123"},
    )
    assert wrong.status_code == 400

    same = client.post(
        "/api/auth/change-password",
        json={"current_password": "StrongPass123", "new_password": "StrongPass123"},
    )
    assert same.status_code == 400

    changed = client.post(
        "/api/auth/change-password",
        json={"current_password": "StrongPass123", "new_password": "BrandNew123"},
    )
    assert changed.status_code == 200, changed.text
    assert client.get("/api/auth/me").status_code == 200
    assert other.get("/api/auth/me").status_code == 401
    other.close()

    client.post("/api/auth/logout")
    assert client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "BrandNew123"}
    ).status_code == 200


def _populate(client: TestClient) -> None:
    create_transaction(client, amount="950.00", merchant="Food place")
    client.post(
        "/api/budgets",
        json={
            "category_id": category_id(client, "food-dining"),
            "month": date.today().replace(day=1).isoformat(),
            "limit_amount": "1000.00",
        },
    )
    goal = client.post("/api/goals", json={"name": "Trip", "target_amount": "50000.00"}).json()
    client.post(
        f"/api/goals/{goal['id']}/contributions",
        json={"amount": "1000.00", "contributed_on": date.today().isoformat()},
    )
    client.post(
        "/api/bills",
        json={"name": "Internet", "amount": "999.00", "due_date": date.today().isoformat()},
    )
    client.post("/api/ai/chat", json={"message": "What is my net cash flow this month?"})
    client.post("/api/notifications/evaluate", params={"force": True})


def _rows_owned_by(user_id: int) -> dict[str, int]:
    inspector = inspect(TEST_ENGINE)
    counts = {}
    with TEST_ENGINE.connect() as connection:
        for table in inspector.get_table_names():
            columns = {column["name"] for column in inspector.get_columns(table)}
            if "user_id" in columns:
                counts[table] = connection.execute(
                    text(f"SELECT count(*) FROM {table} WHERE user_id = :uid"), {"uid": user_id}
                ).scalar()
    return counts


def test_delete_account_removes_every_owned_row_and_nothing_else(client: TestClient) -> None:
    signup(client, email="bob@example.com", name="Bob Rao")
    _populate(client)
    client.post("/api/auth/logout")

    signup(client)
    _populate(client)
    with TestingSession() as db:
        alice_id = db.scalar(select(User.id).where(User.email == "alice@example.com"))
        bob_id = db.scalar(select(User.id).where(User.email == "bob@example.com"))
    before = _rows_owned_by(alice_id)
    assert before["transactions"] and before["budgets"] and before["ai_sessions"]
    bob_before = _rows_owned_by(bob_id)

    wrong = client.post("/api/auth/delete-account", json={"password": "nope"})
    assert wrong.status_code == 400

    deleted = client.post("/api/auth/delete-account", json={"password": "StrongPass123"})
    assert deleted.status_code == 200, deleted.text

    assert all(count == 0 for count in _rows_owned_by(alice_id).values())
    assert _rows_owned_by(bob_id) == bob_before
    with TestingSession() as db:
        assert db.scalar(select(func.count(User.id)).where(User.id == alice_id)) == 0
    assert client.get("/api/auth/me").status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "StrongPass123"}
    ).status_code == 401


def test_demo_account_cannot_change_password_or_be_deleted(client: TestClient) -> None:
    client.post("/api/auth/demo")
    change = client.post(
        "/api/auth/change-password",
        json={"current_password": "Demo@12345", "new_password": "Hijacked123"},
    )
    assert change.status_code == 403
    delete = client.post("/api/auth/delete-account", json={"password": "Demo@12345"})
    assert delete.status_code == 403
    assert client.get("/api/auth/me").status_code == 200
