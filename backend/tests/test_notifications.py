from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.conftest import category_id, create_transaction, signup


def current_month() -> date:
    return date.today().replace(day=1)


def test_budget_notifications_are_created_and_deduplicated(client: TestClient) -> None:
    signup(client)
    food = category_id(client, "food-dining")
    budget = client.post(
        "/api/budgets",
        json={"category_id": food, "month": current_month().isoformat(), "limit_amount": "1000.00"},
    )
    assert budget.status_code == 201
    create_transaction(client, amount="950.00", merchant="Food place")

    first = client.post("/api/notifications/evaluate", params={"force": True})
    assert first.status_code == 200, first.text
    assert first.json()["created"] >= 1

    notifications = client.get("/api/notifications").json()
    assert notifications["unread"] >= 1
    budget_notifications = [item for item in notifications["items"] if item["category"] == "budget_threshold"]
    assert budget_notifications
    assert budget_notifications[0]["severity"] == "critical"
    assert budget_notifications[0]["amount"] == 950.0
    assert budget_notifications[0]["event_key"].startswith("budget_")

    second = client.post("/api/notifications/evaluate")
    assert second.status_code == 200
    assert second.json()["created"] == 0


def test_notification_read_unread_dismiss_and_read_all(client: TestClient) -> None:
    signup(client)
    food = category_id(client, "food-dining")
    client.post(
        "/api/budgets",
        json={"category_id": food, "month": current_month().isoformat(), "limit_amount": "1000.00"},
    )
    create_transaction(client, amount="950.00", merchant="Food place")
    client.post("/api/notifications/evaluate", params={"force": True})
    item = client.get("/api/notifications").json()["items"][0]
    unread_before = client.get("/api/notifications/unread-count").json()["unread"]

    read = client.post(f"/api/notifications/{item['id']}/read")
    assert read.status_code == 200
    assert read.json()["is_read"] is True
    assert client.get("/api/notifications/unread-count").json()["unread"] == unread_before - 1

    unread = client.post(f"/api/notifications/{item['id']}/unread")
    assert unread.status_code == 200
    assert unread.json()["is_read"] is False
    assert client.get("/api/notifications/unread-count").json()["unread"] == unread_before

    dismissed = client.delete(f"/api/notifications/{item['id']}")
    assert dismissed.status_code == 200
    visible_total = client.get("/api/notifications").json()["total"]
    all_total = client.get("/api/notifications", params={"include_dismissed": True}).json()["total"]
    assert all_total == visible_total + 1

    client.post("/api/notifications/read-all")
    assert client.get("/api/notifications/unread-count").json()["unread"] == 0


def test_preferences_persist_and_validate(client: TestClient) -> None:
    signup(client)
    prefs = client.get("/api/notifications/preferences").json()
    assert prefs["budget_warning_enabled"] is True
    assert prefs["quiet_start"] == "22:00"

    updated = client.put(
        "/api/notifications/preferences",
        json={
            "budget_warning_enabled": False,
            "quiet_hours_enabled": True,
            "quiet_start": "21:30",
            "quiet_end": "06:30",
            "warning_threshold": 65,
            "critical_threshold": 88,
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["budget_warning_enabled"] is False
    assert updated.json()["quiet_start"] == "21:30"
    assert client.get("/api/notifications/preferences").json()["critical_threshold"] == 88

    invalid = client.put(
        "/api/notifications/preferences",
        json={"warning_threshold": 95, "critical_threshold": 90},
    )
    assert invalid.status_code == 422

    bad_time = client.put(
        "/api/notifications/preferences",
        json={"quiet_start": "9pm"},
    )
    assert bad_time.status_code == 422


def test_disabled_budget_preference_suppresses_new_events(client: TestClient) -> None:
    signup(client)
    client.put("/api/notifications/preferences", json={"budget_warning_enabled": False})
    food = category_id(client, "food-dining")
    client.post(
        "/api/budgets",
        json={"category_id": food, "month": current_month().isoformat(), "limit_amount": "1000.00"},
    )
    create_transaction(client, amount="950.00", merchant="Food place")
    result = client.post("/api/notifications/evaluate", params={"force": True}).json()
    assert all("budget" not in message.lower() for message in result["messages"])
    assert [item for item in client.get("/api/notifications").json()["items"] if item["category"].startswith("budget")] == []


def test_bill_reminders_respect_window_and_paid_state(client: TestClient) -> None:
    signup(client)
    soon = client.post(
        "/api/bills",
        json={
            "name": "Soon bill",
            "amount": "499.00",
            "due_date": (date.today() + timedelta(days=3)).isoformat(),
        },
    )
    assert soon.status_code == 201
    far = client.post(
        "/api/bills",
        json={
            "name": "Far bill",
            "amount": "899.00",
            "due_date": (date.today() + timedelta(days=40)).isoformat(),
        },
    )
    assert far.status_code == 201

    client.post("/api/notifications/evaluate", params={"force": True})
    titles = [item["title"] for item in client.get("/api/notifications").json()["items"]]
    assert any("Soon bill" in title for title in titles)
    assert not any("Far bill" in title for title in titles)

    for item in client.get("/api/notifications", params={"page_size": 100}).json()["items"]:
        if "Soon bill" in item["title"]:
            client.delete(f"/api/notifications/{item['id']}")
    client.patch(f"/api/bills/{soon.json()['id']}", json={"is_paid": True})
    client.post("/api/notifications/evaluate", params={"force": True})
    remaining = [
        item
        for item in client.get("/api/notifications", params={"page_size": 100}).json()["items"]
        if "Soon bill" in item["title"]
    ]
    assert remaining == []
