from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models import Account, AccountTransfer, Transaction, User
from app.schemas import (
    AccountCreate,
    AccountListResponse,
    AccountOut,
    AccountUpdate,
    MessageResponse,
    NetWorthSummary,
    TransferCreate,
    TransferOut,
)
from app.services.accounts import accounts_with_balances, net_worth, owned_account
from app.services.finance import q

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def _get_or_404(db: Session, user: User, account_id: int) -> Account:
    account = owned_account(db, user.id, account_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


def _one(db: Session, user: User, account_id: int) -> AccountOut:
    for account in accounts_with_balances(db, user.id):
        if account.id == account_id:
            return account
    raise HTTPException(status_code=404, detail="Account not found")


@router.get("", response_model=AccountListResponse)
def list_accounts(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> AccountListResponse:
    accounts = accounts_with_balances(db, user.id)
    return AccountListResponse(accounts=accounts, summary=net_worth(db, user.id, accounts))


@router.get("/net-worth", response_model=NetWorthSummary)
def get_net_worth(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> NetWorthSummary:
    return net_worth(db, user.id)


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccountOut:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Account name cannot be empty")
    account = Account(
        user_id=user.id,
        name=name,
        kind=payload.kind,
        institution=_clean(payload.institution),
        last4=payload.last4,
        opening_balance=q(payload.opening_balance),
        opening_date=payload.opening_date,
        credit_limit=q(payload.credit_limit) if payload.credit_limit is not None else None,
    )
    db.add(account)
    db.commit()
    return _one(db, user, account.id)


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: int,
    payload: AccountUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AccountOut:
    account = _get_or_404(db, user, account_id)
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates:
        name = (updates["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="Account name cannot be empty")
        updates["name"] = name
    if "institution" in updates:
        updates["institution"] = _clean(updates["institution"])
    for money_field in ("opening_balance", "credit_limit"):
        if updates.get(money_field) is not None:
            updates[money_field] = q(updates[money_field])
    if "opening_balance" in updates and updates["opening_balance"] is None:
        raise HTTPException(status_code=422, detail="Opening balance cannot be empty")
    if "opening_date" in updates and updates["opening_date"] is None:
        raise HTTPException(status_code=422, detail="Opening date cannot be empty")
    if "kind" in updates and updates["kind"] is None:
        raise HTTPException(status_code=422, detail="Account type cannot be empty")
    for field, value in updates.items():
        setattr(account, field, value)
    db.commit()
    return _one(db, user, account.id)


@router.delete("/{account_id}", response_model=MessageResponse)
def delete_account(
    account_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Delete an account. Its transactions stay in the ledger, unlinked, so
    spending history and budgets are unchanged. Its transfers are removed."""
    account = _get_or_404(db, user, account_id)
    db.execute(
        update(Transaction)
        .where(Transaction.user_id == user.id, Transaction.account_id == account.id)
        .values(account_id=None)
    )
    for transfer in db.scalars(
        select(AccountTransfer).where(
            AccountTransfer.user_id == user.id,
            (AccountTransfer.from_account_id == account.id) | (AccountTransfer.to_account_id == account.id),
        )
    ).all():
        db.delete(transfer)
    db.delete(account)
    db.commit()
    return MessageResponse(message="Account deleted. Its transactions were kept and unlinked.")


@router.get("/transfers", response_model=list[TransferOut])
def list_transfers(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[TransferOut]:
    rows = db.scalars(
        select(AccountTransfer)
        .where(AccountTransfer.user_id == user.id)
        .order_by(AccountTransfer.occurred_on.desc(), AccountTransfer.id.desc())
    ).all()
    return [TransferOut.model_validate(row) for row in rows]


@router.post("/transfers", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
def create_transfer(
    payload: TransferCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransferOut:
    if payload.from_account_id == payload.to_account_id:
        raise HTTPException(status_code=422, detail="Choose two different accounts")
    _get_or_404(db, user, payload.from_account_id)
    _get_or_404(db, user, payload.to_account_id)
    transfer = AccountTransfer(
        user_id=user.id,
        from_account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        amount=q(payload.amount),
        occurred_on=payload.occurred_on,
        note=_clean(payload.note),
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return TransferOut.model_validate(transfer)


@router.delete("/transfers/{transfer_id}", response_model=MessageResponse)
def delete_transfer(
    transfer_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    transfer = db.scalar(
        select(AccountTransfer).where(AccountTransfer.id == transfer_id, AccountTransfer.user_id == user.id)
    )
    if transfer is None:
        raise HTTPException(status_code=404, detail="Transfer not found")
    db.delete(transfer)
    db.commit()
    return MessageResponse(message="Transfer deleted")
