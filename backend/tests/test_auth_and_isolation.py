from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient

from app.core.config import settings
from tests.conftest import category_id, create_transaction, signup


def test_register_login_me_and_logout(client: TestClient) -> None:
    auth = signup(client)
    assert auth["user"]["email"] == "alice@example.com"
    assert auth["user"]["is_demo"] is False
    assert client.get("/api/auth/me").json()["name"] == "Alice Sharma"

    assert client.post("/api/auth/logout").status_code == 200
    assert client.get("/api/auth/me").status_code == 401

    assert (
        client.post(
            "/api/auth/login",
            json={"email": "alice@example.com", "password": "StrongPass123"},
        ).status_code
        == 200
    )
    assert client.get("/api/auth/me").status_code == 200

    wrong = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "wrong-password"},
    )
    assert wrong.status_code == 401


def test_duplicate_registration_is_rejected(client: TestClient) -> None:
    signup(client)
    response = client.post(
        "/api/auth/register",
        json={"name": "Other Alice", "email": "ALICE@example.com", "password": "StrongPass123"},
    )
    assert response.status_code == 409


def test_auth_response_does_not_expose_token_and_cookie_is_hardened(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/auth/register",
        json={"name": "Alice Sharma", "email": "alice@example.com", "password": "StrongPass123"},
    )
    assert response.status_code == 201
    assert "token" not in response.json()
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert client.cookies.get(settings.cookie_name) is not None


def test_logout_revokes_the_issued_session(client: TestClient) -> None:
    signup(client)
    old_token = client.cookies.get(settings.cookie_name)
    assert old_token is not None

    assert client.post("/api/auth/logout").status_code == 200
    client.cookies.set(settings.cookie_name, old_token)
    assert client.get("/api/auth/me").status_code == 401


def test_auth_rate_limit_blocks_repeated_failures(
    client: TestClient, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "auth_rate_limit_attempts", 2)
    signup(client)
    credentials = {"email": "alice@example.com", "password": "wrong-password"}
    assert client.post("/api/auth/login", json=credentials).status_code == 401
    assert client.post("/api/auth/login", json=credentials).status_code == 401
    blocked = client.post("/api/auth/login", json=credentials)
    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == str(settings.auth_rate_limit_window_seconds)


def test_security_headers_and_cross_origin_guard(client: TestClient) -> None:
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Cache-Control"] == "no-store"

    blocked = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "StrongPass123"},
        headers={"Origin": "https://evil.example"},
    )
    assert blocked.status_code == 403
    assert blocked.json()["detail"] == "Cross-origin request rejected"


def test_authorization_header_is_not_accepted_without_a_cookie(client: TestClient) -> None:
    auth = signup(client)
    client.cookies.clear()
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {auth['user']['email']}"},
    )
    assert response.status_code == 401


def test_two_users_cannot_read_or_mutate_each_others_records(client: TestClient) -> None:
    alice = signup(client, email="alice@example.com", name="Alice Sharma")
    alice_txn = create_transaction(client, merchant="Alice only")
    assert alice_txn.status_code == 201
    alice_txn_id = alice_txn.json()["id"]
    alice_budget = client.post(
        "/api/budgets",
        json={
            "category_id": category_id(client, "food-dining"),
            "month": date.today().replace(day=1).isoformat(),
            "limit_amount": "4000.00",
        },
    )
    assert alice_budget.status_code == 201
    alice_budget_id = alice_budget.json()["id"]
    alice_goal = client.post(
        "/api/goals",
        json={"name": "Alice goal", "target_amount": "10000.00"},
    )
    assert alice_goal.status_code == 201
    alice_goal_id = alice_goal.json()["id"]

    client.cookies.clear()
    signup(client, email="bob@example.com", name="Bob Verma")
    bob_token = client.get("/api/auth/me").json()
    assert bob_token["email"] == "bob@example.com"

    assert client.get("/api/transactions").json()["total"] == 0
    assert client.get(f"/api/transactions/{alice_txn_id}").status_code == 404
    assert client.patch(f"/api/transactions/{alice_txn_id}", json={"amount": "1.00"}).status_code == 404
    assert client.delete(f"/api/transactions/{alice_txn_id}").status_code == 404
    assert client.patch(f"/api/budgets/{alice_budget_id}", json={"limit_amount": "1.00"}).status_code == 404
    assert client.delete(f"/api/budgets/{alice_budget_id}").status_code == 404
    assert client.patch(f"/api/goals/{alice_goal_id}", json={"name": "Stolen"}).status_code == 404
    assert client.delete(f"/api/goals/{alice_goal_id}").status_code == 404
    assert client.get("/api/budgets").json()["items"] == []
    assert client.get("/api/goals").json()["items"] == []

    client.cookies.clear()
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "alice@example.com", "password": "StrongPass123"},
        ).status_code
        == 200
    )
    response = client.get(f"/api/transactions/{alice_txn_id}")
    assert response.status_code == 200
    assert response.json()["merchant"] == "Alice only"


def test_user_cannot_read_another_users_ai_or_research_data(client: TestClient) -> None:
    signup(client, email="alice@example.com", name="Alice Sharma")
    alice_session = client.post(
        "/api/ai/chat",
        json={"message": "How much did I spend this month?"},
    )
    assert alice_session.status_code == 200
    session_id = alice_session.json()["session_id"]
    run = client.post("/api/research/runs", json={"limit": 1})
    assert run.status_code == 202
    run_id = run.json()["id"]

    client.cookies.clear()
    signup(client, email="bob@example.com", name="Bob Verma")
    assert client.get(f"/api/ai/sessions/{session_id}").status_code == 404
    assert client.delete(f"/api/ai/sessions/{session_id}").status_code == 404
    assert client.get(f"/api/research/runs/{run_id}").status_code == 404
    assert client.get(f"/api/research/runs/{run_id}/export").status_code == 404
    assert client.delete(f"/api/research/runs/{run_id}").status_code == 404


def test_only_demo_user_can_reset_demo_data(client: TestClient) -> None:
    signup(client)
    assert client.post("/api/auth/demo/reset").status_code == 403
    client.cookies.clear()
    assert client.post("/api/auth/demo/reset").status_code == 401


def test_validation_errors_do_not_create_records(client: TestClient) -> None:
    signup(client)
    response = client.post(
        "/api/transactions",
        json={
            "type": "expense",
            "amount": "0",
            "occurred_on": date.today().isoformat(),
            "category_id": category_id(client, "food-dining"),
            "merchant": "Zero",
        },
    )
    assert response.status_code == 422
    assert client.get("/api/transactions").json()["total"] == 0

    income_category = category_id(client, "salary")
    wrong_kind = client.post(
        "/api/transactions",
        json={
            "type": "expense",
            "amount": "10",
            "occurred_on": date.today().isoformat(),
            "category_id": income_category,
            "merchant": "Wrong kind",
        },
    )
    assert wrong_kind.status_code == 422
