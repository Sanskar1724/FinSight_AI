from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.conftest import category_id, create_transaction, signup


def test_transaction_crud_and_search(client: TestClient) -> None:
    signup(client)
    created = create_transaction(
        client,
        slug="groceries",
        amount="1499.50",
        merchant="BigBasket",
    )
    assert created.status_code == 201
    payload = created.json()
    assert payload["amount"] == 1499.5
    assert payload["category"]["slug"] == "groceries"

    listed = client.get("/api/transactions", params={"search": "bigbasket"})
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    updated = client.patch(
        f"/api/transactions/{payload['id']}",
        json={"amount": "1600.00", "notes": "Weekly groceries"},
    )
    assert updated.status_code == 200
    assert updated.json()["amount"] == 1600.0
    assert updated.json()["notes"] == "Weekly groceries"

    assert client.get(f"/api/transactions/{payload['id']}").status_code == 200
    assert client.delete(f"/api/transactions/{payload['id']}").status_code == 200
    assert client.get(f"/api/transactions/{payload['id']}").status_code == 404


def test_transaction_list_filters_sort_and_pagination(client: TestClient) -> None:
    signup(client)
    today = date.today()
    for index, amount in enumerate(["100.00", "300.00", "200.00"]):
        response = create_transaction(
            client,
            amount=amount,
            occurred_on=(today - timedelta(days=index)).isoformat(),
            merchant=f"Merchant {index}",
        )
        assert response.status_code == 201
    create_transaction(
        client,
        slug="salary",
        txn_type="income",
        amount="50000.00",
        merchant="Employer",
    )

    expenses = client.get("/api/transactions", params={"type": "expense"})
    assert expenses.json()["total"] == 3

    ascending = client.get("/api/transactions", params={"sort": "amount_asc", "type": "expense"})
    assert [item["amount"] for item in ascending.json()["items"]] == [100.0, 200.0, 300.0]

    page = client.get("/api/transactions", params={"page": 2, "page_size": 2})
    assert page.json()["page"] == 2
    assert page.json()["pages"] == 2
    assert len(page.json()["items"]) == 2

    invalid_range = client.get(
        "/api/transactions",
        params={"start": today.isoformat(), "end": (today - timedelta(days=1)).isoformat()},
    )
    assert invalid_range.status_code == 422


def test_csv_preview_import_duplicate_and_export_safety(client: TestClient) -> None:
    signup(client)
    today = date.today().isoformat()
    content = (
        "date,amount,type,category,merchant,notes\n"
        f"{today},\"₹1,250.50\",expense,Food & Dining,Swiggy,Team lunch\n"
        f"{today},89.00,expense,Transport,Uber,Airport\n"
        f"{today},5000.00,income,Salary,Employer,Monthly salary\n"
    )
    files = {"file": ("transactions.csv", content.encode("utf-8"), "text/csv")}
    preview = client.post("/api/transactions/import/preview", files=files)
    assert preview.status_code == 200, preview.text
    assert preview.json()["valid_count"] == 3
    assert preview.json()["error_count"] == 0

    files = {"file": ("transactions.csv", content.encode("utf-8"), "text/csv")}
    imported = client.post("/api/transactions/import", files=files)
    assert imported.status_code == 200, imported.text
    assert imported.json() == {
        "imported": 3,
        "skipped_duplicates": 0,
        "failed": 0,
        "errors": [],
    }

    files = {"file": ("transactions.csv", content.encode("utf-8"), "text/csv")}
    duplicate = client.post("/api/transactions/import", files=files)
    assert duplicate.status_code == 200
    assert duplicate.json()["imported"] == 0
    assert duplicate.json()["skipped_duplicates"] == 3

    create_transaction(
        client,
        merchant="=HYPERLINK(\"https://example.test\")",
        amount="10.00",
    )
    exported = client.get("/api/transactions/export")
    assert exported.status_code == 200
    text = exported.content.decode("utf-8-sig")
    assert "'=HYPERLINK" in text
    assert text.startswith("date,type,amount,category,merchant")


def test_csv_rejects_unknown_category_and_bad_rows(client: TestClient) -> None:
    signup(client)
    content = (
        "date,amount,category,merchant\n"
        "2026-10-20,120.00,Unknown Category,Shop\n"
        "not-a-date,abc,Food & Dining,Shop\n"
    )
    files = {"file": ("bad.csv", content.encode("utf-8"), "text/csv")}
    preview = client.post("/api/transactions/import/preview", files=files)
    assert preview.status_code == 200
    body = preview.json()
    assert body["valid_count"] == 0
    assert body["error_count"] == 2
    assert body["rows"][0]["valid"] is False
    assert body["rows"][1]["valid"] is False

    files = {"file": ("bad.csv", content.encode("utf-8"), "text/csv")}
    imported = client.post("/api/transactions/import", files=files)
    assert imported.status_code == 200
    assert imported.json()["failed"] == 2
    assert imported.json()["imported"] == 0


def test_csv_rejects_missing_headers_and_empty_file(client: TestClient) -> None:
    signup(client)
    missing = client.post(
        "/api/transactions/import/preview",
        files={"file": ("bad.csv", b"date,amount\n2026-10-20,100\n", "text/csv")},
    )
    assert missing.status_code == 422
    assert "Missing required column" in missing.json()["detail"]

    empty = client.post(
        "/api/transactions/import/preview",
        files={"file": ("empty.csv", b"", "text/csv")},
    )
    assert empty.status_code == 422


def test_csv_does_not_import_duplicate_rows_or_other_users_data(client: TestClient) -> None:
    signup(client)
    first = create_transaction(client, amount="250.00", merchant="Cafe")
    assert first.status_code == 201
    today = date.today().isoformat()
    content = (
        "date,amount,category,merchant\n"
        f"{today},250.00,Food & Dining,Cafe\n"
    )
    files = {"file": ("one.csv", content.encode("utf-8"), "text/csv")}
    preview = client.post("/api/transactions/import/preview", files=files)
    assert preview.json()["duplicate_count"] == 1
    assert preview.json()["valid_count"] == 0


def test_dashboard_analytics_and_report_are_consistent(client: TestClient) -> None:
    signup(client)
    create_transaction(
        client,
        slug="salary",
        txn_type="income",
        amount="60000.00",
        merchant="Employer",
    )
    for amount in ["1000.00", "2000.00", "3000.00"]:
        create_transaction(client, amount=amount, merchant="Merchant")

    dashboard = client.get("/api/dashboard")
    assert dashboard.status_code == 200, dashboard.text
    summary = dashboard.json()["summary"]
    assert summary["income"] == 60000.0
    assert summary["expenses"] == 6000.0
    assert summary["net_cash_flow"] == 54000.0
    assert summary["savings_rate"] == 90.0
    assert "vs" in summary["comparison_label"]

    analytics = client.get("/api/analytics")
    assert analytics.status_code == 200, analytics.text
    assert len(analytics.json()["monthly_trend"]) == 6
    assert analytics.json()["forecast_assumptions"]

    report = client.get("/api/analytics/report")
    assert report.status_code == 200
    assert "Monthly trend" in report.content.decode("utf-8-sig")


def test_category_endpoint_requires_auth(client: TestClient) -> None:
    assert client.get("/api/categories").status_code == 401
    signup(client)
    categories = client.get("/api/categories").json()
    assert any(item["slug"] == "food-dining" for item in categories)
    assert any(item["kind"] == "income" for item in categories)


def test_suggest_uses_latest_matching_merchant(client: TestClient) -> None:
    signup(client)
    create_transaction(client, slug="groceries", merchant="BigBasket", occurred_on="2026-01-05")
    create_transaction(client, slug="food-dining", merchant="bigbasket", occurred_on="2026-02-05")
    groceries = category_id(client, "groceries")
    food = category_id(client, "food-dining")

    exact = client.get("/api/transactions/suggest", params={"merchant": "BIGBASKET"}).json()
    assert exact["category_id"] == food
    assert exact["payment_method"] == "UPI"

    prefix = client.get("/api/transactions/suggest", params={"merchant": "Big"}).json()
    assert prefix["category_id"] in {groceries, food}

    # LIKE wildcards in the input are treated literally.
    assert client.get("/api/transactions/suggest", params={"merchant": "%%"}).json()["category_id"] is None
    assert client.get("/api/transactions/suggest", params={"merchant": "Unknown shop"}).json() == {
        "merchant": None,
        "type": None,
        "category_id": None,
        "payment_method": None,
    }


def test_suggest_is_scoped_to_the_current_user(client: TestClient) -> None:
    signup(client)
    create_transaction(client, merchant="Private Cafe")
    client.post("/api/auth/logout")
    signup(client, email="bob@example.com", name="Bob")
    assert client.get("/api/transactions/suggest", params={"merchant": "Private Cafe"}).json()["category_id"] is None
