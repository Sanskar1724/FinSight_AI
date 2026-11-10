"""Turn a parsed statement into reviewable rows and import the chosen ones."""

from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Account, Category, Transaction, User
from app.schemas import (
    StatementBalanceCheck,
    StatementImportRequest,
    StatementImportResponse,
    StatementPreviewResponse,
    StatementPreviewRow,
)
from app.services.csv_import import existing_signatures, transaction_signature
from app.services.finance import q
from app.services.narration import category_slug_for, parse_narration
from app.services.statement_pdf import ParsedStatement

FALLBACK = {"expense": "other-expense", "income": "other-income"}


def _history_categories(db: Session, user_id: int) -> dict[tuple[str, str], int]:
    """Latest category the user picked for each merchant and direction."""
    rows = db.execute(
        select(Transaction.merchant, Transaction.type, Transaction.category_id)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.occurred_on.asc(), Transaction.id.asc())
    ).all()
    return {(merchant.strip().lower(), txn_type): category_id for merchant, txn_type, category_id in rows}


def _ledger_amounts(
    db: Session, user_id: int, rows: list, statement_type: str
) -> dict[tuple[date, str, Decimal], str]:
    """Existing transactions keyed by date, direction and amount, for the
    statement's date range (plus a day either side)."""
    if not rows:
        return {}
    start = min(row.occurred_on for row in rows) - timedelta(days=1)
    end = max(row.occurred_on for row in rows) + timedelta(days=1)
    found: dict[tuple[date, str, Decimal], str] = {}
    for occurred_on, txn_type, amount, merchant in db.execute(
        select(Transaction.occurred_on, Transaction.type, Transaction.amount, Transaction.merchant).where(
            Transaction.user_id == user_id, Transaction.occurred_on.between(start, end)
        )
    ).all():
        found.setdefault((occurred_on, txn_type, q(Decimal(str(amount)))), merchant)
    return found


def _same_payment(
    existing: dict[tuple[date, str, Decimal], str], occurred_on: date, txn_type: str, amount: Decimal
) -> str | None:
    """The merchant of a ledger entry that is probably this same payment: same
    direction and amount within a day. Banks and UPI apps name the payee
    differently, so the merchant is not compared."""
    for offset in (0, -1, 1):
        merchant = existing.get((occurred_on + timedelta(days=offset), txn_type, q(amount)))
        if merchant:
            return merchant
    return None


def _suggest_account(db: Session, user: User, parsed: ParsedStatement) -> int | None:
    accounts = db.scalars(
        select(Account).where(Account.user_id == user.id, Account.is_archived.is_(False))
    ).all()
    wanted_kinds = {"credit_card"} if parsed.statement_type == "credit_card" else {"bank"}
    if parsed.account_last4:
        for account in accounts:
            if account.last4 == parsed.account_last4 and account.kind in wanted_kinds:
                return account.id
        for account in accounts:
            if account.last4 == parsed.account_last4:
                return account.id
    matches = [account for account in accounts if account.kind in wanted_kinds]
    if parsed.bank:
        same_bank = [a for a in matches if a.institution and a.institution.lower().split()[0] in parsed.bank.lower()]
        if len(same_bank) == 1:
            return same_bank[0].id
    return matches[0].id if len(matches) == 1 else None


def build_preview(db: Session, user: User, parsed: ParsedStatement) -> StatementPreviewResponse:
    categories = db.scalars(select(Category)).all()
    by_slug = {category.slug: category for category in categories}
    by_id = {category.id: category for category in categories}
    history = _history_categories(db, user.id)
    signatures = existing_signatures(db, user.id)
    seen: set[tuple[str, str, str, str]] = set()
    ledger = _ledger_amounts(db, user.id, parsed.rows, parsed.statement_type)

    rows: list[StatementPreviewRow] = []
    for index, raw in enumerate(parsed.rows, start=1):
        narration = parse_narration(raw.description, parsed.statement_type)
        txn_type = raw.type
        category_id: int | None = history.get((narration.merchant.lower(), txn_type))
        category_source = "history" if category_id else None
        if category_id is None or by_id.get(category_id) is None or by_id[category_id].kind != txn_type:
            slug = category_slug_for(f"{narration.merchant} {raw.description}", txn_type)
            category_source = "rule" if slug else "default"
            category = by_slug.get(slug or FALLBACK[txn_type]) or by_slug[FALLBACK[txn_type]]
            category_id = category.id
        is_transfer = narration.transfer_reason is not None
        signature = transaction_signature(raw.occurred_on, txn_type, raw.amount, narration.merchant)
        duplicate = signature in signatures or signature in seen
        likely_same = None if duplicate else _same_payment(ledger, raw.occurred_on, txn_type, raw.amount)
        seen.add(signature)
        note = None
        if is_transfer:
            note = (
                f"{narration.transfer_reason}: money moving between your own accounts, not spending. "
                "Skipped by default; record it as a transfer on the Accounts page if you track that account."
            )
        elif duplicate:
            note = "Already in your ledger (same date, amount, direction and merchant)."
        elif likely_same:
            duplicate = True
            note = (
                f"Probably already in your ledger as '{likely_same}' (same amount within a day), for example "
                "from your bank statement. Skipped by default; tick it if it is a separate payment."
            )
        rows.append(
            StatementPreviewRow(
                row_number=index,
                occurred_on=raw.occurred_on,
                description=raw.description[:300],
                merchant=narration.merchant,
                type=txn_type,
                amount=q(raw.amount),
                balance=q(raw.balance) if raw.balance is not None else None,
                category_id=category_id,
                category_source=category_source or "default",
                payment_method=narration.payment_method,
                is_transfer=is_transfer,
                duplicate=duplicate,
                include=not is_transfer and not duplicate,
                direction_source=raw.direction_source,
                note=note,
            )
        )

    debits = sum((row.amount for row in rows if row.type == "expense"), Decimal("0"))
    credits = sum((row.amount for row in rows if row.type == "income"), Decimal("0"))
    dates = [row.occurred_on for row in rows]
    return StatementPreviewResponse(
        statement_type=parsed.statement_type,
        bank=parsed.bank,
        account_last4=parsed.account_last4,
        suggested_account_id=_suggest_account(db, user, parsed),
        period_start=min(dates) if dates else None,
        period_end=max(dates) if dates else None,
        opening_balance=q(parsed.opening_balance) if parsed.opening_balance is not None else None,
        closing_balance=q(parsed.closing_balance) if parsed.closing_balance is not None else None,
        total_debits=q(debits),
        total_credits=q(credits),
        pages=parsed.pages,
        balance_check=StatementBalanceCheck(
            status=parsed.check.status,
            rows_checked=parsed.check.rows_checked,
            mismatches=parsed.check.mismatches,
            detail=parsed.check.detail,
        ),
        rows=rows,
        warnings=parsed.warnings,
    )


def import_statement_rows(db: Session, user: User, payload: StatementImportRequest) -> StatementImportResponse:
    categories = {category.id: category for category in db.scalars(select(Category)).all()}
    signatures = existing_signatures(db, user.id)
    imported = 0
    skipped = 0
    errors: list[str] = []
    for index, row in enumerate(payload.rows, start=1):
        category = categories.get(row.category_id)
        if category is None:
            errors.append(f"Row {index}: unknown category")
            continue
        if category.kind != row.type:
            errors.append(f"Row {index}: category '{category.name}' is for {category.kind}, not {row.type}")
            continue
        merchant = row.merchant.strip()
        if not merchant:
            errors.append(f"Row {index}: merchant is required")
            continue
        signature = transaction_signature(row.occurred_on, row.type, row.amount, merchant)
        if signature in signatures:
            skipped += 1
            continue
        signatures.add(signature)
        note = f"From statement: {row.description.strip()}"[:2000] if row.description else None
        db.add(
            Transaction(
                user_id=user.id,
                category_id=category.id,
                type=row.type,
                amount=q(row.amount),
                occurred_on=row.occurred_on,
                merchant=merchant[:160],
                notes=note,
                payment_method=(row.payment_method or "Other").strip()[:40] or "Other",
                account_id=payload.account_id,
            )
        )
        imported += 1
    db.commit()
    return StatementImportResponse(imported=imported, skipped_duplicates=skipped, failed=len(errors), errors=errors[:50])

