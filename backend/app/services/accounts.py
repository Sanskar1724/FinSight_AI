"""Account balances and net worth, derived from the ledger.

Balances are never stored. Each one is the opening balance plus linked
transactions and transfers dated on or after the account's opening date, so
every figure can be traced back to records the user can open.

Sign convention:
- Asset accounts (bank, wallet, cash): balance is money held.
  Income adds to it, expenses take from it.
- Liability accounts (credit card, loan): balance is money owed.
  Expenses add to it, income (refunds, cashback) reduces it.
- Transfers move money out of ``from`` and into ``to`` with the same rules,
  so paying a card bill from a bank lowers both the bank balance and the
  amount owed on the card, and leaves net worth unchanged.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Account, AccountTransfer, Transaction
from app.schemas import LIABILITY_KINDS, AccountOut, NetWorthSummary
from app.services.finance import q

ZERO = Decimal("0")
METHOD = (
    "Opening balance plus linked transactions and transfers dated on or after the "
    "opening date. Credit cards and loans count as money owed. Archived accounts and "
    "transactions not linked to an account are excluded."
)


@dataclass
class _Flows:
    inflow: Decimal = ZERO
    outflow: Decimal = ZERO
    count: int = 0
    last: date | None = None

    def add(self, amount: Decimal, incoming: bool, when: date) -> None:
        if incoming:
            self.inflow += amount
        else:
            self.outflow += amount
        self.count += 1
        if self.last is None or when > self.last:
            self.last = when


def is_liability(kind: str) -> bool:
    return kind in LIABILITY_KINDS


def _balance(account: Account, flows: _Flows) -> Decimal:
    opening = Decimal(account.opening_balance or 0)
    if is_liability(account.kind):
        return q(opening + flows.outflow - flows.inflow)
    return q(opening + flows.inflow - flows.outflow)


def _flows_for(db: Session, user_id: int, accounts: list[Account]) -> dict[int, _Flows]:
    flows: dict[int, _Flows] = defaultdict(_Flows)
    if not accounts:
        return flows
    opening = {account.id: account.opening_date for account in accounts}
    rows = db.execute(
        select(Transaction.account_id, Transaction.type, Transaction.amount, Transaction.occurred_on).where(
            Transaction.user_id == user_id, Transaction.account_id.in_(list(opening))
        )
    ).all()
    for account_id, txn_type, amount, occurred_on in rows:
        if occurred_on < opening[account_id]:
            continue
        flows[account_id].add(Decimal(amount), txn_type == "income", occurred_on)
    transfers = db.scalars(select(AccountTransfer).where(AccountTransfer.user_id == user_id)).all()
    for transfer in transfers:
        amount = Decimal(transfer.amount)
        source = opening.get(transfer.from_account_id)
        if source is not None and transfer.occurred_on >= source:
            flows[transfer.from_account_id].add(amount, False, transfer.occurred_on)
        target = opening.get(transfer.to_account_id)
        if target is not None and transfer.occurred_on >= target:
            # Money arriving at a card or loan pays it down, which is an inflow.
            flows[transfer.to_account_id].add(amount, True, transfer.occurred_on)
    return flows


def account_out(account: Account, flows: _Flows) -> AccountOut:
    balance = _balance(account, flows)
    liability = is_liability(account.kind)
    utilisation: float | None = None
    if account.kind == "credit_card" and account.credit_limit and Decimal(account.credit_limit) > 0:
        utilisation = round(float(max(balance, ZERO) / Decimal(account.credit_limit) * 100), 1)
    return AccountOut(
        id=account.id,
        name=account.name,
        kind=account.kind,
        is_liability=liability,
        institution=account.institution,
        last4=account.last4,
        currency=account.currency,
        opening_balance=q(Decimal(account.opening_balance or 0)),
        opening_date=account.opening_date,
        credit_limit=q(Decimal(account.credit_limit)) if account.credit_limit is not None else None,
        is_archived=account.is_archived,
        balance=balance,
        net_worth_contribution=-balance if liability else balance,
        inflow=q(flows.inflow),
        outflow=q(flows.outflow),
        transaction_count=flows.count,
        last_activity=flows.last,
        credit_utilisation_pct=utilisation,
    )


def accounts_with_balances(db: Session, user_id: int) -> list[AccountOut]:
    accounts = list(
        db.scalars(
            select(Account)
            .where(Account.user_id == user_id)
            .order_by(Account.is_archived.asc(), Account.kind.asc(), Account.name.asc())
        ).all()
    )
    flows = _flows_for(db, user_id, accounts)
    return [account_out(account, flows[account.id]) for account in accounts]


def net_worth(db: Session, user_id: int, accounts: list[AccountOut] | None = None) -> NetWorthSummary:
    if accounts is None:
        accounts = accounts_with_balances(db, user_id)
    active = [account for account in accounts if not account.is_archived]
    assets = sum((a.balance for a in active if not a.is_liability), ZERO)
    liabilities = sum((a.balance for a in active if a.is_liability), ZERO)
    unassigned = int(
        db.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.user_id == user_id, Transaction.account_id.is_(None)
            )
        )
        or 0
    )
    return NetWorthSummary(
        assets=q(assets),
        liabilities=q(liabilities),
        net_worth=q(assets - liabilities),
        account_count=len(active),
        unassigned_transactions=unassigned,
        as_of=date.today(),
        method=METHOD,
    )


def owned_account(db: Session, user_id: int, account_id: int) -> Account | None:
    return db.scalar(select(Account).where(Account.id == account_id, Account.user_id == user_id))
