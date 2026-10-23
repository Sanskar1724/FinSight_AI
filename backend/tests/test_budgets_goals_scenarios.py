from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from app.services.finance import add_months
from tests.conftest import category_id, create_transaction, signup


def current_month() -> date:
    return date.today().replace(day=1)


def test_budget_create_update_duplicate_and_delete(client: TestClient) -> None:
    signup(client)
    food = category_id(client, "food-dining")
    created = client.post(
        "/api/budgets",
        json={
            "category_id": food,
            "month": current_month().isoformat(),
            "limit_amount": "5000.00",
        },
    )
    assert created.status_code == 201, created.text
    budget = created.json()
    assert budget["limit_amount"] == 5000.0
    assert budget["status"] == "healthy"

    duplicate = client.post(
        "/api/budgets",
        json={"category_id": food, "month": current_month().isoformat(), "limit_amount": "7000"},
    )
    assert duplicate.status_code == 409

    updated = client.patch(
        f"/api/budgets/{budget['id']}",
        json={"limit_amount": "6000.00", "warning_threshold": 60, "critical_threshold": 85},
    )
    assert updated.status_code == 200
    assert updated.json()["limit_amount"] == 6000.0
    assert updated.json()["warning_threshold"] == 60

    invalid = client.patch(
        f"/api/budgets/{budget['id']}",
        json={"warning_threshold": 95, "critical_threshold": 90},
    )
    assert invalid.status_code == 422

    assert client.delete(f"/api/budgets/{budget['id']}").status_code == 200
    assert client.get("/api/budgets").json()["items"] == []


def test_budget_utilization_and_threshold_state(client: TestClient) -> None:
    signup(client)
    food = category_id(client, "food-dining")
    budget = client.post(
        "/api/budgets",
        json={
            "category_id": food,
            "month": current_month().isoformat(),
            "limit_amount": "1000.00",
        },
    )
    assert budget.status_code == 201
    create_transaction(client, amount="950.00", merchant="Food place")
    current = client.get("/api/budgets").json()["items"][0]
    assert current["actual_spend"] == 950.0
    assert current["utilization"] == 95.0
    assert current["status"] == "critical"
    assert current["threshold_crossed"] == "critical"
    assert current["remaining"] == 50.0
    assert current["risk"] is not None


def test_copy_previous_month_budgets(client: TestClient) -> None:
    signup(client)
    food = category_id(client, "food-dining")
    previous = add_months(current_month(), -1)
    previous_budget = client.post(
        "/api/budgets",
        json={"category_id": food, "month": previous.isoformat(), "limit_amount": "4500.00"},
    )
    assert previous_budget.status_code == 201

    copied = client.post(
        "/api/budgets/copy-previous",
        params={"month": current_month().isoformat()},
    )
    assert copied.status_code == 200, copied.text
    assert len(copied.json()["items"]) == 1
    assert copied.json()["items"][0]["limit_amount"] == 4500.0

    copied_again = client.post(
        "/api/budgets/copy-previous",
        params={"month": current_month().isoformat()},
    )
    assert copied_again.status_code == 200
    assert len(copied_again.json()["items"]) == 1


def test_goal_contributions_and_progress(client: TestClient) -> None:
    signup(client)
    target = (date.today() + timedelta(days=365)).isoformat()
    created = client.post(
        "/api/goals",
        json={"name": "Japan Trip", "target_amount": "120000.00", "target_date": target},
    )
    assert created.status_code == 201, created.text
    goal = created.json()
    assert goal["saved_amount"] == 0.0
    assert goal["status"] in {"on_track", "behind"}

    contribution = client.post(
        f"/api/goals/{goal['id']}/contributions",
        json={
            "amount": "15000.00",
            "contributed_on": date.today().isoformat(),
            "note": "First transfer",
        },
    )
    assert contribution.status_code == 201
    body = contribution.json()
    assert body["saved_amount"] == 15000.0
    assert body["progress_percent"] == 12.5
    assert len(body["contributions"]) == 1

    future = client.post(
        f"/api/goals/{goal['id']}/contributions",
        json={
            "amount": "1000.00",
            "contributed_on": (date.today() + timedelta(days=2)).isoformat(),
        },
    )
    assert future.status_code == 422

    listed = client.get("/api/goals").json()
    assert listed["total_target"] == 120000.0
    assert listed["total_saved"] == 15000.0
    assert listed["overall_progress"] == 12.5

    contribution_id = body["contributions"][0]["id"]
    removed = client.delete(f"/api/goals/{goal['id']}/contributions/{contribution_id}")
    assert removed.status_code == 200
    assert removed.json()["saved_amount"] == 0.0

    assert client.delete(f"/api/goals/{goal['id']}").status_code == 200
    assert client.get("/api/goals").json()["items"] == []


def test_scenario_calculation_and_goal_projection(client: TestClient) -> None:
    signup(client)
    food = category_id(client, "food-dining")
    shopping = category_id(client, "shopping")
    for month_offset in (-3, -2, -1):
        month = add_months(current_month(), month_offset)
        response = create_transaction(
            client,
            amount="1000.00",
            occurred_on=date(month.year, month.month, 10).isoformat(),
            merchant="Food place",
        )
        assert response.status_code == 201
        response = create_transaction(
            client,
            slug="shopping",
            amount="500.00",
            occurred_on=date(month.year, month.month, 12).isoformat(),
            merchant="Shop",
        )
        assert response.status_code == 201
    create_transaction(
        client,
        slug="salary",
        txn_type="income",
        amount="30000.00",
        occurred_on=date(add_months(current_month(), -1).year, add_months(current_month(), -1).month, 1).isoformat(),
        merchant="Employer",
    )
    goal = client.post(
        "/api/goals",
        json={"name": "Laptop", "target_amount": "80000.00"},
    ).json()

    response = client.post(
        "/api/scenarios/simulate",
        json={
            "category_reductions": [{"category_id": food, "reduction_percent": 20}],
            "shopping_reduction_amount": "100.00",
            "income_change": "0.00",
            "additional_monthly_savings": "500.00",
            "one_time_expense": "2000.00",
            "months": 6,
            "goal_id": goal["id"],
        },
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["baseline_monthly_expenses"] == 1500.0
    assert result["adjusted_monthly_expenses"] == 1200.0
    assert result["baseline_monthly_income"] == 10000.0
    assert result["adjusted_net"] == 8800.0
    assert result["monthly_impact"] == 300.0
    assert result["projected_savings"] == 53800.0
    assert result["goal_projection"]["goal_id"] == goal["id"]
    assert result["goal_projection"]["projected_saved"] == 53800.0
    assert "not a prediction" in result["disclaimer"]

    bad_category = client.post(
        "/api/scenarios/simulate",
        json={"category_reductions": [{"category_id": 999999, "reduction_percent": 10}]},
    )
    assert bad_category.status_code == 422


def test_bills_crud_and_upcoming_reminder(client: TestClient) -> None:
    signup(client)
    bill = client.post(
        "/api/bills",
        json={
            "name": "Internet bill",
            "amount": "999.00",
            "due_date": (date.today() + timedelta(days=2)).isoformat(),
        },
    )
    assert bill.status_code == 201
    bill_id = bill.json()["id"]
    assert len(client.get("/api/bills").json()) == 1

    updated = client.patch(f"/api/bills/{bill_id}", json={"is_paid": True})
    assert updated.status_code == 200
    assert updated.json()["is_paid"] is True

    notifications = client.get("/api/notifications", params={"category": "bill_due"}).json()
    assert notifications["total"] >= 1

    assert client.delete(f"/api/bills/{bill_id}").status_code == 200
    assert client.get("/api/bills").json() == []


def test_budget_and_goal_not_found_paths(client: TestClient) -> None:
    signup(client)
    assert client.patch("/api/budgets/99999", json={"limit_amount": "1.00"}).status_code == 404
    assert client.patch("/api/goals/99999", json={"name": "Missing"}).status_code == 404
    assert client.post("/api/goals/99999/contributions", json={"amount": "10", "contributed_on": date.today().isoformat()}).status_code == 404
