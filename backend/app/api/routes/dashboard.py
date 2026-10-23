from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.base import get_db
from app.models import User
from app.schemas import CashFlowSummary, DashboardResponse
from app.services import finance
from app.services.finance import percentage_change
from app.services.ledger import (
    budgets_for_month,
    build_insights,
    category_breakdown,
    goals_for_user,
    period_query,
    previous_period,
    recent_notifications,
    recent_transactions,
    trend_points,
    txns_between,
    txns_like,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    today = date.today()
    start, end = period_query(start, end, today)
    comparison_start, comparison_end = previous_period(start, end)
    transactions = txns_between(db, user.id, start, end)
    comparison_transactions = txns_between(db, user.id, comparison_start, comparison_end)
    flow = finance.cash_flow(txns_like(transactions))
    previous_flow = finance.cash_flow(txns_like(comparison_transactions))
    budget_month = date(end.year, end.month, 1)
    budgets = budgets_for_month(db, user.id, budget_month, today)
    goals = goals_for_user(db, user.id, today)
    insights = build_insights(
        db,
        user.id,
        budgets,
        goals,
        transactions,
        comparison_transactions,
        today,
    )
    history = txns_between(db, user.id, today - timedelta(days=400), today)
    forecast = finance.rolling_average_forecast(txns_like(history), today)
    backtest = finance.backtest_rolling_average(txns_like(history), today)
    next_month = finance.add_months(date(today.year, today.month, 1), 1)

    summary = CashFlowSummary(
        income=flow.income,
        expenses=flow.expenses,
        net_cash_flow=flow.net,
        savings_rate=flow.savings_rate,
        transaction_count=flow.transaction_count,
        income_change=percentage_change(flow.income, previous_flow.income),
        expense_change=percentage_change(flow.expenses, previous_flow.expenses),
        comparison_label=f"vs {comparison_start:%d %b}–{comparison_end:%d %b %Y}",
    )

    forecast_payload = {
        "next_month": next_month.isoformat(),
        "label": finance.month_label(next_month),
        "predicted": float(forecast.predicted),
        "lower": float(forecast.lower),
        "upper": float(forecast.upper),
        "method": forecast.method,
        "months_used": forecast.months_used,
        "assumptions": forecast.assumptions,
        "backtest": {
            "mae": backtest.mae,
            "mape": backtest.mape,
            "sample_size": backtest.sample_size,
            "baseline_mae": backtest.baseline_mae,
            "note": backtest.note,
        },
    }

    return DashboardResponse(
        period={"start": start.isoformat(), "end": end.isoformat()},
        comparison_period={
            "start": comparison_start.isoformat(),
            "end": comparison_end.isoformat(),
        },
        summary=summary,
        trend=trend_points(transactions, start, end),
        category_breakdown=category_breakdown(transactions),
        budgets=budgets,
        goals=goals,
        recent_transactions=recent_transactions(transactions, 6),
        insights=insights,
        notifications=recent_notifications(db, user.id, 5),
        forecast=forecast_payload,
        balance_note=(
            "These figures are period cash flow from records you entered. They are not a bank-account "
            "balance, and FinSight is not connected to your bank or UPI apps."
        ),
    )
