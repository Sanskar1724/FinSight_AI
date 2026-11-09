from __future__ import annotations

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.conftest import category_id, signup

TODAY = date.today()
START = TODAY - timedelta(days=30)


def _account(client: TestClient, **overrides) -> dict:
    body = {"name": "Savings", "kind": "bank", "opening_balance": "10000.00", "opening_date": START.isoformat()}
    body.update(overrides)
    response = client.post("/api/accounts", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _txn(client: TestClient, account_id: int | None, amount: str, *, slug="food-dining", kind="expense", on=None):
    response = client.post(
        "/api/transactions",
        json={
            "type": kind,
            "amount": amount,
            "occurred_on": (on or TODAY).isoformat(),
            "category_id": category_id(client, slug),
            "merchant": "Shop",
            "account_id": account_id,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_asset_balance_follows_linked_transactions(client: TestClient) -> None:
    signup(client)
    bank = _account(client)
    _txn(client, bank["id"], "1500.00")
    _txn(client, bank["id"], "20000.00", slug="salary", kind="income")
    # Before the opening date: already part of the opening balance, so ignored.
    _txn(client, bank["id"], "999.00", on=START - timedelta(days=1))
    # Not linked to any account.
    _txn(client, None, "250.00")

    data = client.get("/api/accounts").json()
    account = data["accounts"][0]
    assert account["balance"] == 28500.0
    assert account["inflow"] == 20000.0
    assert account["outflow"] == 1500.0
    assert account["transaction_count"] == 2
    summary = data["summary"]
    assert summary["assets"] == 28500.0
    assert summary["liabilities"] == 0.0
    assert summary["net_worth"] == 28500.0
    assert summary["unassigned_transactions"] == 1


def test_credit_card_counts_as_owed_and_transfer_pays_it_down(client: TestClient) -> None:
    signup(client)
    bank = _account(client)
    card = _account(
        client, name="Card", kind="credit_card", opening_balance="2000.00", credit_limit="50000.00", last4="1234"
    )
    _txn(client, card["id"], "3000.00")
    _txn(client, card["id"], "500.00", slug="other-income", kind="income")  # refund
    accounts = {a["id"]: a for a in client.get("/api/accounts").json()["accounts"]}
    assert accounts[card["id"]]["balance"] == 4500.0
    assert accounts[card["id"]]["is_liability"] is True
    assert accounts[card["id"]]["net_worth_contribution"] == -4500.0
    assert accounts[card["id"]]["credit_utilisation_pct"] == 9.0

    before = client.get("/api/accounts/net-worth").json()["net_worth"]
    transfer = client.post(
        "/api/accounts/transfers",
        json={
            "from_account_id": bank["id"],
            "to_account_id": card["id"],
            "amount": "4500.00",
            "occurred_on": TODAY.isoformat(),
        },
    )
    assert transfer.status_code == 201, transfer.text
    data = client.get("/api/accounts").json()
    accounts = {a["id"]: a for a in data["accounts"]}
    assert accounts[card["id"]]["balance"] == 0.0
    assert accounts[bank["id"]]["balance"] == 5500.0
    # Paying your own card moves money; it does not change net worth or spending.
    assert data["summary"]["net_worth"] == before == 5500.0
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["summary"]["expenses"] == 3000.0

    assert client.delete(f"/api/accounts/transfers/{transfer.json()['id']}").status_code == 200
    assert client.get("/api/accounts/transfers").json() == []


def test_transfer_validation(client: TestClient) -> None:
    signup(client)
    bank = _account(client)
    same = client.post(
        "/api/accounts/transfers",
        json={"from_account_id": bank["id"], "to_account_id": bank["id"], "amount": "1", "occurred_on": TODAY.isoformat()},
    )
    assert same.status_code == 422
    missing = client.post(
        "/api/accounts/transfers",
        json={"from_account_id": bank["id"], "to_account_id": 9999, "amount": "1", "occurred_on": TODAY.isoformat()},
    )
    assert missing.status_code == 404


def test_update_archive_and_delete_keeps_transactions(client: TestClient) -> None:
    signup(client)
    bank = _account(client)
    txn = _txn(client, bank["id"], "100.00")

    renamed = client.patch(f"/api/accounts/{bank['id']}", json={"name": "Main bank", "opening_balance": "500"})
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Main bank"
    assert renamed.json()["balance"] == 400.0

    archived = client.patch(f"/api/accounts/{bank['id']}", json={"is_archived": True})
    assert archived.json()["is_archived"] is True
    assert client.get("/api/accounts/net-worth").json()["net_worth"] == 0.0

    assert client.patch(f"/api/accounts/{bank['id']}", json={"last4": "12a4"}).status_code == 422

    filtered = client.get("/api/transactions", params={"account_id": bank["id"]}).json()
    assert filtered["total"] == 1

    assert client.delete(f"/api/accounts/{bank['id']}").status_code == 200
    kept = client.get(f"/api/transactions/{txn['id']}")
    assert kept.status_code == 200
    assert kept.json()["account_id"] is None
    assert client.get("/api/transactions", params={"account_id": 0}).json()["total"] == 1


def test_accounts_are_isolated_between_users(client: TestClient) -> None:
    signup(client, email="alice@example.com")
    alice_account = _account(client)
    signup(client, email="bob@example.com", name="Bob Verma")
    assert client.get("/api/accounts").json()["accounts"] == []
    assert client.patch(f"/api/accounts/{alice_account['id']}", json={"name": "x"}).status_code == 404
    assert client.delete(f"/api/accounts/{alice_account['id']}").status_code == 404
    # Bob cannot link his transaction to Alice's account.
    response = client.post(
        "/api/transactions",
        json={
            "type": "expense",
            "amount": "10",
            "occurred_on": TODAY.isoformat(),
            "category_id": category_id(client, "food-dining"),
            "merchant": "Shop",
            "account_id": alice_account["id"],
        },
    )
    assert response.status_code == 422


def test_csv_import_links_rows_to_account(client: TestClient) -> None:
    signup(client)
    bank = _account(client)
    content = f"date,type,amount,category,merchant\n{TODAY.isoformat()},expense,250,Food & Dining,Cafe\n"
    response = client.post(
        "/api/transactions/import",
        params={"account_id": bank["id"]},
        files={"file": ("t.csv", content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["imported"] == 1
    assert client.get("/api/accounts").json()["accounts"][0]["balance"] == 9750.0


def test_demo_has_accounts_that_cover_every_transaction(client: TestClient) -> None:
    assert client.post("/api/auth/demo").status_code == 200
    data = client.get("/api/accounts").json()
    kinds = sorted(a["kind"] for a in data["accounts"])
    assert kinds == ["bank", "cash", "credit_card"]
    assert data["summary"]["unassigned_transactions"] == 0
