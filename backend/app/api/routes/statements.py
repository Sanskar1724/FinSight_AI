"""Bank and credit card statement PDF import.

The PDF is read in memory and never stored. The preview returns every row
with a suggested merchant, category and direction; the person reviews and
edits it, and only the rows they keep are sent back to be imported.
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.base import get_db
from app.models import User
from app.schemas import StatementImportRequest, StatementImportResponse, StatementPreviewResponse
from app.services.accounts import owned_account
from app.services.notifications import create_app_notification, evaluate_notifications
from app.services.statement_import import build_preview, import_statement_rows
from app.services.statement_pdf import StatementError, read_statement

router = APIRouter(prefix="/statements", tags=["statements"])
logger = logging.getLogger(__name__)


@router.post("/preview", response_model=StatementPreviewResponse)
def preview_statement(
    file: UploadFile = File(...),
    password: str | None = Form(default=None, max_length=128),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StatementPreviewResponse:
    content = file.file.read(settings.max_statement_bytes + 1)
    if len(content) > settings.max_statement_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"The PDF is larger than the {settings.max_statement_bytes // 1_000_000} MB limit",
        )
    if not content:
        raise HTTPException(status_code=422, detail="The uploaded file is empty")
    try:
        parsed = read_statement(content, password or None)
    except StatementError as exc:
        raise HTTPException(status_code=422, detail={"code": exc.code, "message": str(exc)}) from None
    except Exception:
        logger.exception("Statement PDF could not be parsed")
        raise HTTPException(
            status_code=422,
            detail={"code": "unreadable", "message": "This statement could not be read. Try a different PDF."},
        ) from None
    return build_preview(db, user, parsed)


@router.post("/import", response_model=StatementImportResponse)
def import_statement(
    payload: StatementImportRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StatementImportResponse:
    if payload.account_id is not None and owned_account(db, user.id, payload.account_id) is None:
        raise HTTPException(status_code=422, detail="Account not found")
    result = import_statement_rows(db, user, payload)
    create_app_notification(
        db,
        user.id,
        "Statement imported" if not result.failed else "Statement imported with errors",
        f"Imported {result.imported} row(s); skipped {result.skipped_duplicates} duplicate(s); "
        f"{result.failed} row(s) failed.",
        event_key=f"statement_import:{user.id}:{uuid.uuid4().hex}",
        severity="warning" if result.failed else "info",
        action_label="Open transactions",
        action_url="/transactions",
    )
    db.commit()
    try:
        evaluate_notifications(db, user)
    except Exception:
        db.rollback()
        logger.exception("Notification evaluation failed after statement import")
    return result
