"""Safe CSV parsing and duplicate detection for transaction imports."""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Category, Transaction, User
from app.services.finance import q

MAX_ROWS = 5000
COLUMN_ALIASES = {
    "date": ["date", "transaction date", "txn date", "value date"],
    "amount": ["amount", "value", "transaction amount", "debit"],
    "type": ["type", "transaction type", "dr/cr", "income/expense"],
    "category": ["category", "category name"],
    "merchant": ["merchant", "description", "payee", "narration"],
    "notes": ["notes", "note", "comment", "remarks"],
    "payment_method": ["payment_method", "payment method", "method", "mode"],
}
REQUIRED = ["date", "amount", "category", "merchant"]


@dataclass
class ParsedRow:
    row_number: int
    data: dict
    errors: list[str] = field(default_factory=list)
    duplicate: bool = False

    @property
    def valid(self) -> bool:
        return not self.errors


@dataclass
class ParseResult:
    rows: list[ParsedRow]
    headers: list[str]
    detected_columns: dict[str, str | None]

    @property
    def valid_count(self) -> int:
        return sum(1 for row in self.rows if row.valid and not row.duplicate)

    @property
    def error_count(self) -> int:
        return sum(1 for row in self.rows if row.errors)

    @property
    def duplicate_count(self) -> int:
        return sum(1 for row in self.rows if row.duplicate and row.valid)


def _normalise_header(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def detect_columns(headers: list[str]) -> dict[str, str | None]:
    normalised = {_normalise_header(header): header for header in headers}
    detected: dict[str, str | None] = {}
    for field, aliases in COLUMN_ALIASES.items():
        detected[field] = next(
            (normalised[alias] for alias in aliases if alias in normalised), None
        )
    return detected


def parse_date(value: str) -> date:
    text = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Unrecognised date '{value}' (use YYYY-MM-DD or DD/MM/YYYY)")


def parse_amount(value: str) -> Decimal:
    text = value.strip().replace("₹", "").replace("Rs.", "").replace("Rs", "").replace(",", "")
    text = text.replace(" ", "")
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text[1:-1]
    try:
        amount = Decimal(text)
    except InvalidOperation:
        raise ValueError(f"Invalid amount '{value}'") from None
    if amount <= 0:
        raise ValueError("Amount must be greater than zero")
    if amount > Decimal("999999999999.99"):
        raise ValueError("Amount exceeds the supported maximum")
    return q(amount)


def transaction_signature(
    occurred_on: date, txn_type: str, amount: Decimal, merchant: str
) -> tuple[str, str, str, str]:
    return (
        occurred_on.isoformat(),
        txn_type,
        str(q(amount)),
        re.sub(r"\s+", " ", merchant.strip().lower()),
    )


def existing_signatures(db: Session, user_id: int) -> set[tuple[str, str, str, str]]:
    rows = db.execute(
        select(
            Transaction.occurred_on,
            Transaction.type,
            Transaction.amount,
            Transaction.merchant,
        ).where(Transaction.user_id == user_id)
    ).all()
    return {
        transaction_signature(row.occurred_on, row.type, Decimal(str(row.amount)), row.merchant)
        for row in rows
    }


def parse_csv(
    db: Session, user: User, content: bytes
) -> ParseResult:
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValueError("File must be UTF-8 encoded CSV") from None
    reader = csv.reader(io.StringIO(decoded))
    try:
        raw_headers = next(reader)
    except StopIteration:
        raise ValueError("The CSV file is empty") from None
    headers = [header.strip() for header in raw_headers]
    detected = detect_columns(headers)
    missing = [field for field in REQUIRED if not detected[field]]
    if missing:
        raise ValueError(
            "Missing required column(s): "
            + ", ".join(missing)
            + ". Required headers: date, amount, category, merchant."
        )
    header_index = {header: index for index, header in enumerate(headers)}
    categories = db.scalars(select(Category)).all()
    category_lookup = {
        key: category
        for category in categories
        for key in (category.name.lower(), category.slug.lower())
    }
    signature_set = existing_signatures(db, user.id)
    rows: list[ParsedRow] = []
    for row_number, raw_row in enumerate(reader, start=2):
        if len(rows) >= MAX_ROWS:
            raise ValueError(f"CSV imports are limited to {MAX_ROWS} rows")
        if not any(cell.strip() for cell in raw_row):
            continue
        values = {
            header: (raw_row[index].strip() if index < len(raw_row) else "")
            for header, index in header_index.items()
        }
        data: dict = {}
        errors: list[str] = []
        try:
            occurred_on = parse_date(values.get(detected["date"] or "", ""))
            data["date"] = occurred_on.isoformat()
        except ValueError as exc:
            occurred_on = None
            errors.append(str(exc))
        try:
            amount = parse_amount(values.get(detected["amount"] or "", ""))
            data["amount"] = float(amount)
        except ValueError as exc:
            amount = None
            errors.append(str(exc))
        raw_type = (values.get(detected["type"] or "", "") or "expense").strip().lower()
        if raw_type in {"debit", "dr", "expense"}:
            txn_type = "expense"
        elif raw_type in {"credit", "cr", "income"}:
            txn_type = "income"
        else:
            txn_type = None
            errors.append("Type must be income or expense")
        data["type"] = txn_type or raw_type
        category_name = values.get(detected["category"] or "", "").strip()
        category = category_lookup.get(category_name.lower())
        if not category_name:
            errors.append("Category is required")
        elif category is None:
            errors.append(f"Unknown category '{category_name}'")
        else:
            data["category"] = category.name
            data["category_id"] = category.id
            if txn_type and category.kind != txn_type:
                errors.append(f"Category '{category.name}' is for {category.kind}, not {txn_type}")
        merchant = values.get(detected["merchant"] or "", "").strip()
        if not merchant:
            errors.append("Merchant is required")
        data["merchant"] = merchant
        notes = values.get(detected["notes"] or "", "").strip()
        data["notes"] = notes or None
        payment_method = (
            values.get(detected["payment_method"] or "", "").strip() or "UPI"
        )
        data["payment_method"] = payment_method
        duplicate = False
        if occurred_on and amount and txn_type and merchant:
            signature = transaction_signature(occurred_on, txn_type, amount, merchant)
            duplicate = signature in signature_set
            signature_set.add(signature)
        rows.append(ParsedRow(row_number=row_number, data=data, errors=errors, duplicate=duplicate))
    return ParseResult(rows=rows, headers=headers, detected_columns=detected)


def import_rows(db: Session, user: User, parse_result: ParseResult) -> dict:
    imported = 0
    skipped = 0
    failed = 0
    errors: list[str] = []
    existing = existing_signatures(db, user.id)
    for row in parse_result.rows:
        if row.errors:
            failed += 1
            errors.append(f"Row {row.row_number}: " + "; ".join(row.errors))
            continue
        data = row.data
        signature = transaction_signature(
            date.fromisoformat(data["date"]),
            data["type"],
            Decimal(str(data["amount"])),
            data["merchant"],
        )
        if signature in existing:
            skipped += 1
            continue
        db.add(
            Transaction(
                user_id=user.id,
                category_id=data["category_id"],
                type=data["type"],
                amount=q(Decimal(str(data["amount"]))),
                occurred_on=date.fromisoformat(data["date"]),
                merchant=data["merchant"][:160],
                notes=data.get("notes"),
                payment_method=(data.get("payment_method") or "UPI")[:40],
            )
        )
        existing.add(signature)
        imported += 1
    db.commit()
    return {
        "imported": imported,
        "skipped_duplicates": skipped,
        "failed": failed,
        "errors": errors[:50],
    }
