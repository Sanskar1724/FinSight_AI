from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models import Category, SavingsGoal, User
from app.schemas import (
    ScenarioCategoryChange,
    ScenarioGoalProjection,
    ScenarioRequest,
    ScenarioResponse,
)
from app.services import finance
from app.services.finance import average_monthly_baseline, q, simulate_scenario
from app.services.ledger import category_map, goals_for_user, txns_between, txns_like

router = APIRouter(prefix="/scenarios", tags=["scenarios"])


@router.post("/simulate", response_model=ScenarioResponse)
def simulate(
    payload: ScenarioRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScenarioResponse:
    today = date.today()
    current_month = date(today.year, today.month, 1)
    start = finance.add_months(current_month, -3)
    _, end = finance.month_bounds(finance.add_months(current_month, -1))
    baseline_txns = txns_between(db, user.id, start, end) if start <= end else []
    baseline = average_monthly_baseline(txns_like(baseline_txns), start, end)
    used_partial_month = False
    if baseline.months_used == 0:
        baseline_txns = txns_between(db, user.id, current_month, today)
        baseline = average_monthly_baseline(
            txns_like(baseline_txns), current_month, today
        )
        used_partial_month = True

    categories = category_map(db)
    category_names = {
        category_id: categories[category_id].name
        if category_id in categories
        else "Unknown"
        for category_id in baseline.category_spend
    }

    reductions: dict[int, float] = {}
    for item in payload.category_reductions:
        category = categories.get(item.category_id)
        if category is None:
            raise HTTPException(status_code=422, detail=f"Unknown category {item.category_id}")
        if category.kind != "expense":
            raise HTTPException(status_code=422, detail="Reductions apply to expense categories only")
        reductions[item.category_id] = item.reduction_percent

    shopping_category = db.scalar(select(Category).where(Category.slug == "shopping"))
    result = simulate_scenario(
        baseline_category_spend=baseline.category_spend,
        category_names=category_names,
        baseline_income=baseline.income,
        category_reductions=reductions,
        shopping_category_id=shopping_category.id if shopping_category else None,
        shopping_reduction_amount=q(payload.shopping_reduction_amount),
        income_change=q(payload.income_change),
        additional_monthly_savings=q(payload.additional_monthly_savings),
        one_time_expense=q(payload.one_time_expense),
        months=payload.months,
    )

    goal_projection = None
    if payload.goal_id is not None:
        goal = db.scalar(
            select(SavingsGoal)
            .options(selectinload(SavingsGoal.contributions))
            .where(SavingsGoal.id == payload.goal_id, SavingsGoal.user_id == user.id)
        )
        if goal is None:
            raise HTTPException(status_code=404, detail="Savings goal not found")
        goal_view = next(
            (item for item in goals_for_user(db, user.id, today) if item.id == goal.id), None
        )
        if goal_view is not None:
            projected_saved = q(
                goal_view.saved_amount + max(Decimal("0"), result.projected_savings)
            )
            progress = (
                float(min(Decimal("100"), q(projected_saved / goal_view.target_amount * 100)))
                if goal_view.target_amount > 0
                else 0.0
            )
            goal_projection = ScenarioGoalProjection(
                goal_id=goal.id,
                name=goal.name,
                current_saved=goal_view.saved_amount,
                projected_saved=projected_saved,
                progress_percent=progress,
                target_date=goal.target_date,
                note=(
                    f"Adds the hypothetical savings surplus over {payload.months} month(s) to the current "
                    "saved amount. It does not model investment returns or withdrawals."
                ),
            )

    assumptions = list(result.assumptions)
    if used_partial_month:
        if baseline.months_used:
            assumptions.insert(
                0,
                "No complete month with recorded transactions was available, so the current partial month is used as the baseline.",
            )
        else:
            assumptions.insert(
                0,
                "No transactions were recorded in the three-month baseline window or the current month, so baseline values are zero.",
            )
    else:
        month_word = "month" if baseline.months_used == 1 else "months"
        month_labels = ", ".join(
            finance.month_label(month) for month in baseline.months
        )
        assumptions.insert(
            0,
            f"Baseline uses {baseline.months_used} complete {month_word} with recorded "
            f"transactions ({month_labels}). Months with no recorded transactions, "
            "including months before your first record, are excluded and not treated as zero. "
            "The app cannot infer whether those months had no activity or missing records.",
        )

    return ScenarioResponse(
        baseline_monthly_income=result.baseline_income,
        baseline_monthly_expenses=result.baseline_expenses,
        adjusted_monthly_income=result.adjusted_income,
        adjusted_monthly_expenses=result.adjusted_expenses,
        baseline_net=q(result.baseline_income - result.baseline_expenses),
        adjusted_net=result.monthly_impact,
        monthly_impact=q(result.monthly_impact - (result.baseline_income - result.baseline_expenses)),
        one_time_expense=q(payload.one_time_expense),
        horizon_months=payload.months,
        projected_savings=result.projected_savings,
        category_changes=[
            ScenarioCategoryChange(**change) for change in result.category_changes
        ],
        goal_projection=goal_projection,
        assumptions=assumptions,
        disclaimer=(
            "Hypothetical scenario only. It is not a prediction, promise, or financial recommendation. "
            "Results depend entirely on the assumptions entered and exclude investment returns, taxes, and "
            "unplanned expenses."
        ),
    )
