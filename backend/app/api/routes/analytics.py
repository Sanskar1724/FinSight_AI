from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.base import get_db, utcnow
from app.models import (
    AnomalyFeedback,
    Category,
    RecurringOverride,
    Transaction,
    User,
)
from app.schemas import (
    AnalyticsResponse,
    AnomalyFeedbackRequest,
    AnomalyOut,
    BacktestResult,
    BudgetAdherence,
    CategoryComparison,
    ForecastPoint,
    MessageResponse,
    MonthlyTrend,
    RecurringCandidate,
    RecurringFeedbackRequest,
)
from app.services import finance
from app.services.finance import detect_anomalies, detect_recurring_payments, q
from app.services.ledger import (
    as_txn,
    budgets_for_month,
    category_breakdown,
    category_map,
    dec,
    previous_period,
    txns_between,
    txns_like,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _range(start: date | None, end: date | None) -> tuple[date, date]:
    today = date.today()
    end = end or today
    if start is None:
        start = finance.add_months(date(end.year, end.month, 1), -5)
    if start > end:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date")
    if (end - start).days > 732:
        raise HTTPException(status_code=422, detail="Date range cannot exceed two years")
    return start, end


def _build_analytics(db: Session, user: User, start: date, end: date, today: date) -> AnalyticsResponse:
    transactions = txns_between(db, user.id, start, end)
    comparison_start, comparison_end = previous_period(start, end)
    comparison_transactions = txns_between(db, user.id, comparison_start, comparison_end)
    categories = category_map(db)
    monthly = finance.monthly_totals(
        txns_like(transactions),
        date(start.year, start.month, 1),
        date(end.year, end.month, 1),
    )
    monthly_trend = [
        MonthlyTrend(
            month=item["month"],
            label=finance.month_label(item["month_date"]),
            income=item["income"],
            expenses=item["expenses"],
            net=item["net"],
            savings_rate=item["savings_rate"],
        )
        for item in monthly
    ]
    current_breakdown = category_breakdown(transactions)
    previous_breakdown = {
        item.category_id: dec(item.amount) for item in category_breakdown(comparison_transactions)
    }
    total_current = sum((dec(item.amount) for item in current_breakdown), q(0))
    comparison_items: list[CategoryComparison] = []
    for item in current_breakdown:
        previous = previous_breakdown.get(item.category_id, q(0))
        comparison_items.append(
            CategoryComparison(
                category_id=item.category_id,
                name=item.name,
                color=item.color,
                current=item.amount,
                previous=previous,
                change=finance.percentage_change(dec(item.amount), previous),
                share=float(q(dec(item.amount) / total_current * 100)) if total_current > 0 else 0.0,
            )
        )
    current_ids = {item.category_id for item in current_breakdown}
    for category_id, previous in previous_breakdown.items():
        if category_id in current_ids:
            continue
        category = categories.get(category_id)
        if category is None:
            continue
        comparison_items.append(
            CategoryComparison(
                category_id=category_id,
                name=category.name,
                color=category.color,
                current=q(0),
                previous=previous,
                change=finance.percentage_change(q(0), previous),
                share=0.0,
            )
        )
    comparison_items.sort(key=lambda item: float(item.current), reverse=True)

    budget_month = date(end.year, end.month, 1)
    budgets = budgets_for_month(db, user.id, budget_month, today)
    adherence = [
        BudgetAdherence(
            category_id=budget.category.id,
            category_name=budget.category.name,
            limit_amount=budget.limit_amount,
            actual_spend=budget.actual_spend,
            utilization=budget.utilization,
            status=budget.status,
            on_track=budget.status in {"healthy", "approaching"},
        )
        for budget in budgets
    ]

    history = txns_between(db, user.id, today - timedelta(days=220), today)
    history_likes = txns_like(history)
    recurring = detect_recurring_payments(history_likes, today)
    overrides = {
        row.merchant_key: row.status
        for row in db.scalars(
            select(RecurringOverride).where(RecurringOverride.user_id == user.id)
        ).all()
    }
    recurring_out = [
        RecurringCandidate(
            merchant_key=item.merchant_key,
            merchant=item.merchant,
            category_name=categories[item.category_id].name
            if item.category_id in categories
            else "Unknown",
            average_amount=item.average_amount,
            last_amount=item.last_amount,
            frequency=item.frequency,
            interval_days=item.interval_days,
            occurrences=item.occurrences,
            last_seen=item.last_seen,
            next_expected=item.next_expected,
            confidence=item.confidence,
            status=(
                "confirmed"
                if overrides.get(item.merchant_key) == "confirmed"
                else "dismissed"
                if overrides.get(item.merchant_key) == "dismissed"
                else "candidate"
            ),
            explanation=item.explanation,
        )
        for item in recurring[:12]
    ]

    anomalies = detect_anomalies(history_likes, today)
    feedback = {
        row.transaction_id: row.status
        for row in db.scalars(
            select(AnomalyFeedback).where(AnomalyFeedback.user_id == user.id)
        ).all()
    }
    txn_by_id = {txn.id: txn for txn in history}
    anomaly_out = []
    for item in anomalies[:12]:
        txn = txn_by_id.get(item.transaction_id)
        if txn is None:
            continue
        category = categories.get(item.category_id)
        anomaly_out.append(
            AnomalyOut(
                transaction_id=item.transaction_id,
                merchant=item.merchant,
                category_name=category.name if category else "Unknown",
                amount=item.amount,
                occurred_on=item.occurred_on,
                median_amount=item.median_amount,
                mad_amount=item.mad_amount,
                score=item.score,
                threshold=item.threshold,
                sample_size=item.sample_size,
                explanation=item.explanation,
                feedback=feedback.get(item.transaction_id),
            )
        )

    forecast = finance.rolling_average_forecast(history_likes, today)
    backtest = finance.backtest_rolling_average(history_likes, today)
    next_month = finance.add_months(date(today.year, today.month, 1), 1)
    forecast_points = [
        ForecastPoint(
            month=finance.month_key(next_month),
            label=finance.month_label(next_month),
            predicted=forecast.predicted,
            lower=forecast.lower,
            upper=forecast.upper,
        )
    ]
    assumptions = forecast.assumptions + [
        "Forecasts use only records entered in FinSight and only months completed before the forecast date.",
        "A range is shown instead of a single guaranteed number.",
    ]
    return AnalyticsResponse(
        period={"start": start.isoformat(), "end": end.isoformat()},
        monthly_trend=monthly_trend,
        category_comparison=comparison_items,
        category_breakdown=current_breakdown,
        budget_adherence=adherence,
        recurring=recurring_out,
        anomalies=anomaly_out,
        forecast=forecast_points,
        forecast_assumptions=assumptions,
        backtest=BacktestResult(
            method=backtest.method,
            mae=backtest.mae,
            mape=backtest.mape,
            sample_size=backtest.sample_size,
            baseline_method=backtest.baseline_method,
            baseline_mae=backtest.baseline_mae,
            note=backtest.note,
        ),
        generated_at=utcnow(),
    )


@router.get("", response_model=AnalyticsResponse)
def get_analytics(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalyticsResponse:
    start, end = _range(start, end)
    return _build_analytics(db, user, start, end, date.today())


@router.post("/recurring/{merchant_key}/feedback", response_model=MessageResponse)
def recurring_feedback(
    merchant_key: str,
    payload: RecurringFeedbackRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MessageResponse:
    override = db.scalar(
        select(RecurringOverride).where(
            RecurringOverride.user_id == user.id,
            RecurringOverride.merchant_key == merchant_key,
        )
    )
    if override is None:
        override = RecurringOverride(
            user_id=user.id, merchant_key=merchant_key[:160], status=payload.status
        )
        db.add(override)
    else:
        override.status = payload.status
    db.commit()
    return MessageResponse(message=f"Recurring candidate marked {payload.status}")


@router.post("/anomalies/{transaction_id}/feedback", response_model=MessageResponse)
def anomaly_feedback(
    transaction_id: int,
    payload: AnomalyFeedbackRequest,
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
    feedback = db.scalar(
        select(AnomalyFeedback).where(
            AnomalyFeedback.user_id == user.id,
            AnomalyFeedback.transaction_id == transaction_id,
        )
    )
    if feedback is None:
        feedback = AnomalyFeedback(
            user_id=user.id,
            transaction_id=transaction_id,
            status=payload.status,
            note=payload.note,
        )
        db.add(feedback)
    else:
        feedback.status = payload.status
        feedback.note = payload.note
    db.commit()
    return MessageResponse(message=f"Unusual-spending indicator marked {payload.status}")


@router.get("/report")
def download_report(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    start, end = _range(start, end)
    analytics = _build_analytics(db, user, start, end, date.today())
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["FinSight AI financial report (fictional data if using demo account)"])
    writer.writerow(["Period", start.isoformat(), end.isoformat()])
    writer.writerow([])
    writer.writerow(["Monthly trend"])
    writer.writerow(["Month", "Income", "Expenses", "Net", "Savings rate"])
    for item in analytics.monthly_trend:
        writer.writerow(
            [
                item.label,
                f"{item.income:.2f}",
                f"{item.expenses:.2f}",
                f"{item.net:.2f}",
                "" if item.savings_rate is None else f"{item.savings_rate:.2f}%",
            ]
        )
    writer.writerow([])
    writer.writerow(["Category breakdown for selected period"])
    writer.writerow(["Category", "Amount", "Share", "Transactions"])
    for item in analytics.category_breakdown:
        writer.writerow([item.name, f"{item.amount:.2f}", f"{item.percent:.2f}%", item.transaction_count])
    writer.writerow([])
    writer.writerow(["Budget adherence"])
    writer.writerow(["Category", "Limit", "Spend", "Utilisation", "Status"])
    for item in analytics.budget_adherence:
        writer.writerow(
            [
                item.category_name,
                f"{item.limit_amount:.2f}",
                f"{item.actual_spend:.2f}",
                f"{item.utilization:.2f}%",
                item.status,
            ]
        )
    writer.writerow([])
    writer.writerow(["Forecast"])
    writer.writerow(["Method", analytics.backtest.method])
    writer.writerow(["Backtest MAE", analytics.backtest.mae])
    writer.writerow(["Backtest MAPE", analytics.backtest.mape])
    writer.writerow(["Sample size", analytics.backtest.sample_size])
    for point in analytics.forecast:
        writer.writerow(["Next month", point.label, point.predicted, point.lower, point.upper])
    content = "\ufeff" + output.getvalue()
    return StreamingResponse(
        iter([content]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="finsight-report.csv"'},
    )
