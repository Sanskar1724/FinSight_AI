from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models import Budget, User
from app.schemas import (
    BudgetCreate,
    BudgetListResponse,
    BudgetOut,
    BudgetUpdate,
    MessageResponse,
)
from app.services.finance import add_months, q
from app.services.ledger import build_budget_out, budgets_for_month, resolve_category

router = APIRouter(prefix="/budgets", tags=["budgets"])


def parse_month(value: str | None) -> date:
    if value is None:
        today = date.today()
        return date(today.year, today.month, 1)
    try:
        if len(value) == 7:
            parsed = datetime.strptime(value + "-01", "%Y-%m-%d").date()
        else:
            parsed = date.fromisoformat(value).replace(day=1)
    except ValueError:
        raise HTTPException(status_code=422, detail="Month must be YYYY-MM or YYYY-MM-DD") from None
    return parsed


def _list_response(db: Session, user: User, month: date) -> BudgetListResponse:
    items = budgets_for_month(db, user.id, month)
    total_limit = q(sum((item.limit_amount for item in items), q(0)))
    total_spend = q(sum((item.actual_spend for item in items), q(0)))
    utilization = float(q(total_spend / total_limit * 100)) if total_limit > 0 else 0.0
    return BudgetListResponse(
        items=items,
        total_limit=total_limit,
        total_spend=total_spend,
        overall_utilization=utilization,
        month=month,
    )


@router.get("", response_model=BudgetListResponse)
def list_budgets(
    month: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetListResponse:
    return _list_response(db, user, parse_month(month))


@router.post("", response_model=BudgetOut, status_code=status.HTTP_201_CREATED)
def create_budget(
    payload: BudgetCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetOut:
    category = resolve_category(db, payload.category_id, "expense")
    month = payload.month.replace(day=1)
    if month.year < 2000 or month.year > 2100:
        raise HTTPException(status_code=422, detail="Budget month is outside the supported range")
    existing = db.scalar(
        select(Budget).where(
            Budget.user_id == user.id,
            Budget.category_id == category.id,
            Budget.month == month,
        )
    )
    if existing is not None:
        raise HTTPException(
            status_code=409, detail="A budget already exists for this category and month"
        )
    budget = Budget(
        user_id=user.id,
        category_id=category.id,
        month=month,
        limit_amount=q(payload.limit_amount),
        warning_threshold=payload.warning_threshold,
        critical_threshold=payload.critical_threshold,
    )
    db.add(budget)
    db.commit()
    budget = db.scalar(
        select(Budget).options(joinedload(Budget.category)).where(Budget.id == budget.id)
    )
    assert budget is not None
    return build_budget_out(db, budget)


@router.patch("/{budget_id}", response_model=BudgetOut)
def update_budget(
    budget_id: int,
    payload: BudgetUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetOut:
    budget = db.scalar(
        select(Budget)
        .options(joinedload(Budget.category))
        .where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    updates = payload.model_dump(exclude_unset=True)
    warning = updates.get("warning_threshold", budget.warning_threshold)
    critical = updates.get("critical_threshold", budget.critical_threshold)
    if critical <= warning:
        raise HTTPException(
            status_code=422, detail="Critical threshold must be greater than warning threshold"
        )
    if "limit_amount" in updates and updates["limit_amount"] is not None:
        updates["limit_amount"] = q(updates["limit_amount"])
    for field, value in updates.items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    return build_budget_out(db, budget)


@router.delete("/{budget_id}", response_model=MessageResponse)
def delete_budget(
    budget_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    budget = db.scalar(
        select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id)
    )
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    return MessageResponse(message="Budget deleted")


@router.post("/copy-previous", response_model=BudgetListResponse)
def copy_previous_month(
    month: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> BudgetListResponse:
    target = parse_month(month)
    previous = add_months(target, -1)
    previous_budgets = db.scalars(
        select(Budget).where(Budget.user_id == user.id, Budget.month == previous)
    ).all()
    if not previous_budgets:
        raise HTTPException(status_code=404, detail="No previous-month budgets to copy")
    existing = {
        budget.category_id
        for budget in db.scalars(
            select(Budget).where(Budget.user_id == user.id, Budget.month == target)
        ).all()
    }
    for budget in previous_budgets:
        if budget.category_id in existing:
            continue
        db.add(
            Budget(
                user_id=user.id,
                category_id=budget.category_id,
                month=target,
                limit_amount=budget.limit_amount,
                warning_threshold=budget.warning_threshold,
                critical_threshold=budget.critical_threshold,
            )
        )
    db.commit()
    return _list_response(db, user, target)
