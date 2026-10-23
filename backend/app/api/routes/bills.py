from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models import Bill, User
from app.schemas import BillCreate, BillOut, BillUpdate, MessageResponse
from app.services.finance import q
from app.services.ledger import dec
from app.services.notifications import evaluate_notifications

router = APIRouter(prefix="/bills", tags=["bills"])


def _bill_out(bill: Bill) -> BillOut:
    return BillOut(
        id=bill.id,
        name=bill.name,
        amount=dec(bill.amount),
        due_date=bill.due_date,
        is_paid=bill.is_paid,
    )


@router.get("", response_model=list[BillOut])
def list_bills(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[BillOut]:
    bills = db.scalars(
        select(Bill)
        .where(Bill.user_id == user.id)
        .order_by(Bill.is_paid.asc(), Bill.due_date.asc())
    ).all()
    return [_bill_out(bill) for bill in bills]


@router.post("", response_model=BillOut, status_code=status.HTTP_201_CREATED)
def create_bill(
    payload: BillCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BillOut:
    bill = Bill(
        user_id=user.id,
        name=payload.name.strip(),
        amount=q(payload.amount),
        due_date=payload.due_date,
        is_paid=payload.is_paid,
    )
    db.add(bill)
    db.commit()
    try:
        evaluate_notifications(db, user)
    except Exception:
        db.rollback()
    db.refresh(bill)
    return _bill_out(bill)


@router.patch("/{bill_id}", response_model=BillOut)
def update_bill(
    bill_id: int,
    payload: BillUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BillOut:
    bill = db.scalar(select(Bill).where(Bill.id == bill_id, Bill.user_id == user.id))
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    updates = payload.model_dump(exclude_unset=True)
    if "amount" in updates and updates["amount"] is not None:
        updates["amount"] = q(updates["amount"])
    if "name" in updates and updates["name"] is not None:
        updates["name"] = updates["name"].strip()
    for field, value in updates.items():
        setattr(bill, field, value)
    db.commit()
    try:
        evaluate_notifications(db, user)
    except Exception:
        db.rollback()
    db.refresh(bill)
    return _bill_out(bill)


@router.delete("/{bill_id}", response_model=MessageResponse)
def delete_bill(
    bill_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    bill = db.scalar(select(Bill).where(Bill.id == bill_id, Bill.user_id == user.id))
    if bill is None:
        raise HTTPException(status_code=404, detail="Bill not found")
    db.delete(bill)
    db.commit()
    return MessageResponse(message="Bill deleted")
