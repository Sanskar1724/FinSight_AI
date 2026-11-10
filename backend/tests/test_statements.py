from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient

from app.services.narration import category_slug_for, parse_narration
from app.services.statement_pdf import read_statement
from tests import statement_fixtures as fixtures
from tests.conftest import category_id, signup


def _preview(client: TestClient, content: bytes, password: str | None = None):
    data = {"password": password} if password else {}
    return client.post(
        "/api/statements/preview",
        files={"file": ("statement.pdf", content, "application/pdf")},
        data=data,
    )


def _slug_of(client: TestClient, category: int) -> str:
    return next(item["slug"] for item in client.get("/api/categories").json() if item["id"] == category)


# ---------- reading the PDF ----------

def test_withdrawal_and_deposit_columns_with_wrapped_narration_and_two_pages() -> None:
    parsed = read_statement(fixtures.hdfc_style())
    assert parsed.bank == "HDFC Bank"
    assert parsed.account_last4 == "4821"
    assert parsed.statement_type == "bank"
    assert len(parsed.rows) == 7
    first, salary = parsed.rows[0], parsed.rows[1]
    assert (first.occurred_on, first.type, str(first.amount)) == (date(2026, 10, 1), "expense", "450.00")
    assert "412345678901-Dinner" in first.description  # wrapped line joined
    assert (salary.type, str(salary.amount)) == ("income", "85000.00")
    assert str(parsed.opening_balance) == "50000.00"
    assert str(parsed.closing_balance) == "100186.50"
    assert parsed.check.status == "verified"
    assert parsed.check.rows_checked == 7


def test_three_word_dates_value_date_column_and_cr_balances() -> None:
    parsed = read_statement(fixtures.sbi_style())
    assert parsed.bank == "State Bank of India"
    assert [(r.occurred_on.day, r.type, str(r.amount)) for r in parsed.rows] == [
        (1, "expense", "320.00"),
        (3, "income", "500.00"),
        (4, "expense", "212.40"),
    ]
    assert parsed.check.status == "verified"


def test_running_balance_decides_direction_without_a_header() -> None:
    parsed = read_statement(fixtures.no_header_style())
    assert [(r.type, str(r.amount)) for r in parsed.rows] == [
        ("expense", "120.00"),
        ("income", "35.00"),
        ("expense", "1415.00"),
    ]
    assert all(row.direction_source == "balance" for row in parsed.rows)
    assert parsed.check.status == "verified"


def test_credit_card_statement_uses_cr_marker() -> None:
    parsed = read_statement(fixtures.credit_card_style())
    assert parsed.statement_type == "credit_card"
    assert parsed.account_last4 == "9034"
    assert [(r.type, str(r.amount)) for r in parsed.rows] == [
        ("expense", "2499.00"),
        ("income", "12480.00"),
        ("expense", "6250.00"),
        ("income", "499.00"),
    ]
    assert parsed.check.status == "unchecked"


def test_balance_mismatch_is_reported() -> None:
    parsed = read_statement(fixtures.hdfc_style(break_balance=True))
    assert parsed.check.status == "mismatch"
    assert parsed.check.mismatches >= 1


# ---------- narrations ----------

def test_narrations_give_merchant_method_and_category() -> None:
    cases = [
        ("UPI/DR/412345678901/SWIGGY/YESB/swiggy@yespay/Payment", "Swiggy", "UPI", "food-dining"),
        ("UPI-ZOMATO LTD-zomato.payu@axisbank-UTIB0000100-312345678901-PAYMENT", "Zomato Ltd", "UPI", "food-dining"),
        ("POS 512345XXXXXX1234 BIGBASKET BANGALORE", "Bigbasket Bangalore", "Debit Card", "groceries"),
        ("ACH D- TP ACH NETFLIX-1234567", "Netflix", "Auto Debit", "subscriptions"),
        ("UPI-IRCTC WEB-irctc@hdfcbank-HDFC0000499-123456789012-TICKET", "IRCTC Web", "UPI", "transport"),
    ]
    for text, merchant, method, slug in cases:
        narration = parse_narration(text)
        assert narration.merchant == merchant, text
        assert narration.payment_method == method, text
        assert category_slug_for(f"{narration.merchant} {text}", "expense") == slug, text


def test_transfers_and_special_rows_are_recognised() -> None:
    assert parse_narration("ATM WDL-SBI ATM KORAMANGALA").transfer_reason == "ATM cash withdrawal"
    assert parse_narration("CREDIT CARD PAYMENT XX9034").transfer_reason == "Credit card bill payment"
    assert parse_narration("PAYMENT RECEIVED - THANK YOU", "credit_card").transfer_reason
    assert parse_narration("INT.PD 01-07-2026 TO 30-09-2026").merchant == "Interest"
    assert parse_narration("SMS ALERT CHRG QTR").merchant == "Bank charges"
    # Whole-word matching: "cola" is not Ola, "current" is not rent.
    assert category_slug_for("Coca Cola current account", "expense") is None
    assert category_slug_for("Acme salary oct", "income") == "salary"


# ---------- API ----------

def test_preview_suggests_rows_skips_transfers_and_matches_account(client: TestClient) -> None:
    signup(client)
    bank = client.post(
        "/api/accounts",
        json={"name": "Salary account", "kind": "bank", "last4": "4821", "opening_balance": "50000", "opening_date": "2026-09-30"},
    ).json()
    response = _preview(client, fixtures.hdfc_style())
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["bank"] == "HDFC Bank"
    assert data["suggested_account_id"] == bank["id"]
    assert data["balance_check"]["status"] == "verified"
    assert data["total_credits"] == 85000.0
    rows = {row["merchant"]: row for row in data["rows"]}
    assert _slug_of(client, rows["Swiggy"]["category_id"]) == "food-dining"
    assert _slug_of(client, rows["Acme Technologies Pvt Ltd"]["category_id"]) == "salary"
    assert rows["ATM cash withdrawal"]["is_transfer"] and not rows["ATM cash withdrawal"]["include"]
    assert rows["Credit card bill payment"]["is_transfer"] and not rows["Credit card bill payment"]["include"]
    assert sum(row["include"] for row in data["rows"]) == 5


def test_password_protected_statement(client: TestClient) -> None:
    signup(client)
    content = fixtures.hdfc_style(password="AARA0101")
    missing = _preview(client, content)
    assert missing.status_code == 422
    assert missing.json()["detail"]["code"] == "password_required"
    wrong = _preview(client, content, "wrong")
    assert wrong.json()["detail"]["code"] == "password_incorrect"
    right = _preview(client, content, "AARA0101")
    assert right.status_code == 200
    assert len(right.json()["rows"]) == 7


def test_rejects_non_pdf_and_scanned_files(client: TestClient) -> None:
    signup(client)
    assert _preview(client, b"date,amount\n").json()["detail"]["code"] == "not_pdf"
    assert _preview(client, fixtures.scanned_style()).json()["detail"]["code"] == "no_text"
    assert _preview(client, b"").status_code == 422


def test_import_links_account_skips_duplicates_and_learns_categories(client: TestClient) -> None:
    signup(client)
    bank = client.post(
        "/api/accounts",
        json={"name": "Savings", "kind": "bank", "opening_balance": "50000", "opening_date": "2026-09-30"},
    ).json()
    preview = _preview(client, fixtures.hdfc_style()).json()
    chosen = [row for row in preview["rows"] if row["include"]]
    # Re-categorise Priya Sharma (rent by keyword) as Other to check that the
    # next statement remembers the choice.
    other = category_id(client, "other-expense")
    payload_rows = [
        {
            "occurred_on": row["occurred_on"],
            "type": row["type"],
            "amount": f"{row['amount']:.2f}",
            "merchant": row["merchant"],
            "category_id": other if row["merchant"] == "Priya Sharma" else row["category_id"],
            "payment_method": row["payment_method"],
            "description": row["description"],
        }
        for row in chosen
    ]
    result = client.post("/api/statements/import", json={"account_id": bank["id"], "rows": payload_rows})
    assert result.status_code == 200, result.text
    assert result.json() == {"imported": 5, "skipped_duplicates": 0, "failed": 0, "errors": []}

    accounts = client.get("/api/accounts").json()["accounts"]
    assert accounts[0]["transaction_count"] == 5
    assert accounts[0]["balance"] == 50000 + 85000 - 450 - 1234.5 - 649 - 18000

    again = client.post("/api/statements/import", json={"account_id": bank["id"], "rows": payload_rows})
    assert again.json()["imported"] == 0
    assert again.json()["skipped_duplicates"] == 5

    second = _preview(client, fixtures.hdfc_style()).json()
    rows = {row["merchant"]: row for row in second["rows"]}
    assert rows["Swiggy"]["duplicate"] and not rows["Swiggy"]["include"]
    assert rows["Priya Sharma"]["category_id"] == other
    assert rows["Priya Sharma"]["category_source"] == "history"

    txn = client.get("/api/transactions", params={"search": "Swiggy"}).json()["items"][0]
    assert txn["notes"].startswith("From statement:")
    assert txn["account_id"] == bank["id"]


def test_import_validates_category_kind_and_account_owner(client: TestClient) -> None:
    signup(client, email="alice@example.com")
    alice_account = client.post(
        "/api/accounts", json={"name": "A", "kind": "bank", "opening_date": "2026-01-01"}
    ).json()
    signup(client, email="bob@example.com", name="Bob Verma")
    row = {
        "occurred_on": "2026-10-01",
        "type": "expense",
        "amount": "10.00",
        "merchant": "Shop",
        "category_id": category_id(client, "salary"),
    }
    bad_kind = client.post("/api/statements/import", json={"rows": [row]})
    assert bad_kind.json()["failed"] == 1
    assert bad_kind.json()["imported"] == 0
    foreign = client.post(
        "/api/statements/import", json={"account_id": alice_account["id"], "rows": [row]}
    )
    assert foreign.status_code == 422


def test_statement_endpoints_require_login(client: TestClient) -> None:
    assert _preview(client, fixtures.hdfc_style()).status_code == 401
