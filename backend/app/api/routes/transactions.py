from __future__ import annotations

import csv
import hashlib
import io
import logging
import re
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.base import get_db
from app.models import Category, Transaction, User
from app.schemas import (
    CSVImportResponse,
    CSVPreviewResponse,
    CSVRowPreview,
    MessageResponse,
    TransactionCreate,
    TransactionOut,
    TransactionPage,
    TransactionSuggestion,
    TransactionUpdate,
)
from app.services.csv_import import import_rows, parse_csv
from app.services.csv_safety import csv_text
from app.services.finance import detect_anomalies, q
from app.services.ledger import as_txn, dec, resolve_category, txns_between

from app.services.notifications import (
    clear_anomaly_notifications,
    create_app_notification,
    evaluate_notifications,
)

router = APIRouter(prefix="/transactions", tags=["transactions"])
logger = logging.getLogger(__name__)


def _validate_type_and_category(db: Session, txn_type: str, category_id: int) -> None:
    if txn_type not in {"income", "expense"}:
        raise HTTPException(status_code=422, detail="Type must be income or expense")
    resolve_category(db, category_id, txn_type)


def _evaluate_after_change(db: Session, user: User) -> None:
    try:
        evaluate_notifications(db, user)
    except Exception:
        db.rollback()
        logger.exception("Notification evaluation failed after transaction mutation")


def _query_transactions(
    db: Session,
    user: User,
    *,
    start: date | None,
    end: date | None,
    txn_type: str | None,
    category_id: int | None,
    search: str | None,
    flagged: str | None,
    sort: str,
):
    conditions = [Transaction.user_id == user.id]
    if start:
        conditions.append(Transaction.occurred_on >= start)
    if end:
        conditions.append(Transaction.occurred_on <= end)
    if txn_type:
        if txn_type not in {"income", "expense"}:
            raise HTTPException(status_code=422, detail="Invalid transaction type filter")
        conditions.append(Transaction.type == txn_type)
    if category_id:
        conditions.append(Transaction.category_id == category_id)
    use_join = False
    if search:
        term = f"%{search.strip()}%"
        conditions.append(
            or_(
                Transaction.merchant.ilike(term),
                Transaction.notes.ilike(term),
                Category.name.ilike(term),
            )
        )
        use_join = True
    if flagged:
        # "1" (or any non-numeric value) means "all current anomalies"; any other
        # integer targets a single transaction, as used by notification links.
        if flagged.isdigit() and flagged != "1":
            flagged_ids = [int(flagged)]
        else:
            today = date.today()
            recent = txns_between(db, user.id, today - timedelta(days=365), today)
            anomalies = detect_anomalies([as_txn(txn) for txn in recent], today)
            flagged_ids = [item.transaction_id for item in anomalies]
        conditions.append(Transaction.id.in_(flagged_ids))
    statement = select(Transaction).options(joinedload(Transaction.category)).where(*conditions)
    count_statement = select(func.count(Transaction.id)).where(*conditions)
    if use_join:
        statement = statement.join(Transaction.category)
        count_statement = count_statement.join(Transaction.category)
    order = {
        "date_desc": (Transaction.occurred_on.desc(), Transaction.id.desc()),
        "date_asc": (Transaction.occurred_on.asc(), Transaction.id.asc()),
        "amount_desc": (Transaction.amount.desc(), Transaction.occurred_on.desc()),
        "amount_asc": (Transaction.amount.asc(), Transaction.occurred_on.desc()),
    }.get(sort, (Transaction.occurred_on.desc(), Transaction.id.desc()))
    statement = statement.order_by(*order)
    return statement, count_statement


@router.get("", response_model=TransactionPage)
def list_transactions(
    start: date | None = None,
    end: date | None = None,
    type: str | None = None,
    category_id: int | None = None,
    search: str | None = Query(default=None, max_length=120),
    flagged: str | None = None,
    sort: str = Query(default="date_desc", pattern="^(date|amount)_(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionPage:
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date")
    statement, count_statement = _query_transactions(
        db,
        user,
        start=start,
        end=end,
        txn_type=type,
        category_id=category_id,
        search=search,
        flagged=flagged,
        sort=sort,
    )
    total = int(db.scalar(count_statement) or 0)
    rows = db.scalars(statement.offset((page - 1) * page_size).limit(page_size)).all()
    import math

    return TransactionPage(
        items=[TransactionOut.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.post("", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionOut:
    _validate_type_and_category(db, payload.type, payload.category_id)
    txn = Transaction(
        user_id=user.id,
        type=payload.type,
        amount=q(payload.amount),
        occurred_on=payload.occurred_on,
        category_id=payload.category_id,
        merchant=payload.merchant.strip(),
        notes=payload.notes.strip() if payload.notes else None,
        payment_method=payload.payment_method.strip() or "UPI",
    )
    if not txn.merchant:
        raise HTTPException(status_code=422, detail="Merchant cannot be empty")
    db.add(txn)
    db.commit()
    db.refresh(txn)
    _evaluate_after_change(db, user)
    db.refresh(txn)
    return TransactionOut.model_validate(txn)


@router.get("/suggest", response_model=TransactionSuggestion)
def suggest_transaction_fields(
    merchant: str = Query(min_length=2, max_length=120),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionSuggestion:
    """Suggest category and payment method from the user's own history.

    An exact (case-insensitive) merchant match wins; otherwise the most recent
    merchant starting with the typed text is used.
    """
    term = merchant.strip()
    if len(term) < 2:
        return TransactionSuggestion()
    base = select(Transaction).where(Transaction.user_id == user.id)
    recent = (Transaction.occurred_on.desc(), Transaction.id.desc())
    match = db.scalar(
        base.where(func.lower(Transaction.merchant) == term.lower()).order_by(*recent).limit(1)
    )
    if match is None:
        match = db.scalar(
            base.where(Transaction.merchant.istartswith(term, autoescape=True))
            .order_by(*recent)
            .limit(1)
        )
    if match is None:
        return TransactionSuggestion()
    return TransactionSuggestion(
        merchant=match.merchant,
        type=match.type,
        category_id=match.category_id,
        payment_method=match.payment_method,
    )


@router.get("/export")
def export_transactions(
    start: date | None = None,
    end: date | None = None,
    type: str | None = None,
    category_id: int | None = None,
    search: str | None = Query(default=None, max_length=120),
    flagged: str | None = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    statement, _ = _query_transactions(
        db,
        user,
        start=start,
        end=end,
        txn_type=type,
        category_id=category_id,
        search=search,
        flagged=flagged,
        sort="date_desc",
    )
    rows = db.scalars(statement).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "type", "amount", "category", "merchant", "payment_method", "notes"])

    for row in rows:
        writer.writerow(
            [
                row.occurred_on.isoformat(),
                row.type,
                f"{dec(row.amount):.2f}",
                row.category.name,
                csv_text(row.merchant),
                csv_text(row.payment_method),
                csv_text(row.notes),
            ]
        )
    content = "\ufeff" + output.getvalue()
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="finsight-transactions.csv"'},
    )


def _read_upload(file: UploadFile) -> bytes:
    content = file.file.read(settings.max_upload_bytes + 1)
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_bytes // 1000} KB import limit",
        )
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty")
    return content


@router.post("/import/preview", response_model=CSVPreviewResponse)
def preview_import(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CSVPreviewResponse:
    content = _read_upload(file)
    try:
        parsed = parse_csv(db, user, content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    return CSVPreviewResponse(
        rows=[
            CSVRowPreview(
                row_number=row.row_number,
                valid=row.valid,
                duplicate=row.duplicate,
                errors=row.errors,
                data=row.data,
            )
            for row in parsed.rows[:200]
        ],
        valid_count=parsed.valid_count,
        error_count=parsed.error_count,
        duplicate_count=parsed.duplicate_count,
        headers=parsed.headers,
        detected_columns=parsed.detected_columns,
    )


@router.post("/import", response_model=CSVImportResponse)
def import_transactions(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CSVImportResponse:
    content = _read_upload(file)
    digest = hashlib.sha256(content).hexdigest()[:16]
    try:
        parsed = parse_csv(db, user, content)
    except ValueError as exc:
        create_app_notification(
            db,
            user.id,
            "CSV import failed",
            str(exc),
            event_key=f"csv_failed:{user.id}:{digest}",
            severity="warning",
            action_label="Open transactions",
            action_url="/transactions",
        )
        db.commit()
        raise HTTPException(status_code=422, detail=str(exc)) from None
    result = import_rows(db, user, parsed)
    summary = (
        f"Imported {result['imported']} row(s); skipped {result['skipped_duplicates']} duplicate(s); "
        f"{result['failed']} row(s) failed validation."
    )
    create_app_notification(
        db,
        user.id,
        "CSV import completed with errors" if result["failed"] or result["errors"] else "CSV import completed",
        summary,
        event_key=f"csv_import:{user.id}:{digest}",
        severity="warning" if result["failed"] else "info",
        action_label="Review transactions",
        action_url="/transactions",
    )
    db.commit()
    _evaluate_after_change(db, user)
    return CSVImportResponse(**result)


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionOut:
    txn = db.scalar(
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.id == transaction_id, Transaction.user_id == user.id)
    )
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return TransactionOut.model_validate(txn)


@router.patch("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionOut:
    txn = db.scalar(
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(Transaction.id == transaction_id, Transaction.user_id == user.id)
    )
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        return TransactionOut.model_validate(txn)
    new_type = updates.get("type", txn.type)
    new_category_id = updates.get("category_id", txn.category_id)
    _validate_type_and_category(db, new_type, new_category_id)
    if "amount" in updates and updates["amount"] is not None:
        updates["amount"] = q(Decimal(str(updates["amount"])))
    if "merchant" in updates and updates["merchant"] is not None:
        merchant = updates["merchant"].strip()
        if not merchant:
            raise HTTPException(status_code=422, detail="Merchant cannot be empty")
        updates["merchant"] = merchant
    if "notes" in updates and updates["notes"] is not None:
        updates["notes"] = updates["notes"].strip() or None
    for field, value in updates.items():
        setattr(txn, field, value)
    clear_anomaly_notifications(db, user.id, txn.id)
    db.commit()
    db.refresh(txn)
    _evaluate_after_change(db, user)
    db.refresh(txn)
    return TransactionOut.model_validate(txn)


@router.delete("/{transaction_id}", response_model=MessageResponse)
def delete_transaction(
    transaction_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    txn = db.scalar(
        select(Transaction).where(
            Transaction.id == transaction_id, Transaction.user_id == user.id
        )
    )
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    clear_anomaly_notifications(db, user.id, txn.id)
    db.delete(txn)
    db.commit()
    return MessageResponse(message="Transaction deleted")
