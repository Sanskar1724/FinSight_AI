"""Database adapters that turn owned records into tested calculations."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from typing import Iterable, Sequence

from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.base import utcnow
from app.models import (
    Budget,
    Category,
    GoalContribution,
    Notification,
    SavingsGoal,
    Transaction,
    User,
)
from app.schemas import (
    BudgetOut,
    BudgetRisk,
    CategoryOut,
    CategorySpend,
    ContributionOut,
    GoalOut,
    InsightOut,
    NotificationOut,
    RecentTransaction,
    TrendPoint,
)
from app.services import finance
from app.services.finance import TxnLike, ZERO, q


def dec(value: Decimal | float | int | None) -> Decimal:
    if value is None:
        return ZERO
    return Decimal(str(value)).quantize(Decimal("0.01"))


def as_txn(txn: Transaction) -> TxnLike:
    return TxnLike(
        id=txn.id,
        type=txn.type,
        amount=dec(txn.amount),
        occurred_on=txn.occurred_on,
        category_id=txn.category_id,
        merchant=txn.merchant,
    )


def txns_between(
    db: Session, user_id: int, start: date, end: date
) -> list[Transaction]:
    statement = (
        select(Transaction)
        .options(joinedload(Transaction.category))
        .where(
            Transaction.user_id == user_id,
            Transaction.occurred_on >= start,
            Transaction.occurred_on <= end,
        )
        .order_by(Transaction.occurred_on.desc(), Transaction.id.desc())
    )
    return list(db.scalars(statement).all())


def txns_like(txns: Iterable[Transaction]) -> list[TxnLike]:
    return [as_txn(txn) for txn in txns]


def category_map(db: Session) -> dict[int, Category]:
    return {category.id: category for category in db.scalars(select(Category)).all()}


def resolve_category(db: Session, category_id: int, expected_kind: str | None = None) -> Category:
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status_code=422, detail="Unknown category")
    if expected_kind and category.kind != expected_kind:
        raise HTTPException(
            status_code=422, detail=f"{category.name} is not a {expected_kind} category"
        )
    return category


def period_query(start: date | None, end: date | None, today: date | None = None) -> tuple[date, date]:
    today = today or date.today()
    if end is None:
        end = today
    if start is None:
        start = end.replace(day=1)
    if start > end:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date")
    if (end - start).days > 732:
        raise HTTPException(status_code=422, detail="Date range cannot exceed two years")
    return start, end


def previous_period(start: date, end: date) -> tuple[date, date]:
    length = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return prev_start, prev_end


def trend_points(txns: Sequence[Transaction], start: date, end: date) -> list[TrendPoint]:
    days = (end - start).days + 1
    if days <= 45:
        buckets: dict[date, dict[str, Decimal]] = {}
        cursor = start
        while cursor <= end:
            buckets[cursor] = {"income": ZERO, "expenses": ZERO}
            cursor += timedelta(days=1)
        for txn in txns:
            bucket = buckets.get(txn.occurred_on)
            if bucket is None:
                continue
            bucket["income" if txn.type == "income" else "expenses"] += dec(txn.amount)
        points = []
        for day, values in sorted(buckets.items()):
            income = q(values["income"])
            expenses = q(values["expenses"])
            points.append(
                TrendPoint(
                    label=day.strftime("%d %b"),
                    period=day.isoformat(),
                    income=income,
                    expenses=expenses,
                    net=q(income - expenses),
                )
            )
        return points
    if days <= 120:
        buckets = {}
        cursor = start
        index = 0
        while cursor <= end:
            bucket_end = min(end, cursor + timedelta(days=6))
            buckets[index] = {
                "start": cursor,
                "end": bucket_end,
                "income": ZERO,
                "expenses": ZERO,
            }
            cursor = bucket_end + timedelta(days=1)
            index += 1
        for txn in txns:
            for key, values in buckets.items():
                if values["start"] <= txn.occurred_on <= values["end"]:
                    values["income" if txn.type == "income" else "expenses"] += dec(txn.amount)
                    break
        return [
            TrendPoint(
                label=f"{values['start'].strftime('%d %b')}",
                period=f"{values['start'].isoformat()}..{values['end'].isoformat()}",
                income=q(values["income"]),
                expenses=q(values["expenses"]),
                net=q(values["income"] - values["expenses"]),
            )
            for values in buckets.values()
        ]
    months = finance.monthly_totals(
        [as_txn(txn) for txn in txns], date(start.year, start.month, 1), date(end.year, end.month, 1)
    )
    return [
        TrendPoint(
            label=finance.month_label(item["month_date"]),
            period=item["month"],
            income=item["income"],
            expenses=item["expenses"],
            net=item["net"],
        )
        for item in months
    ]


def category_breakdown(txns: Sequence[Transaction]) -> list[CategorySpend]:
    totals: dict[int, Decimal] = defaultdict(lambda: ZERO)
    counts: dict[int, int] = defaultdict(int)
    categories: dict[int, Category] = {}
    for txn in txns:
        if txn.type != "expense":
            continue
        totals[txn.category_id] += dec(txn.amount)
        counts[txn.category_id] += 1
        if txn.category is not None:
            categories[txn.category_id] = txn.category
    total_spend = sum(totals.values(), ZERO)
    result = []
    for category_id, amount in totals.items():
        category = categories.get(category_id)
        if category is None:
            continue
        result.append(
            CategorySpend(
                category_id=category_id,
                name=category.name,
                color=category.color,
                amount=q(amount),
                percent=float(q(amount / total_spend * 100)) if total_spend > 0 else 0.0,
                transaction_count=counts[category_id],
            )
        )
    result.sort(key=lambda item: float(item.amount), reverse=True)
    return result


def budget_history(
    db: Session, user_id: int, category_id: int, budget_month: date, months: int = 3
) -> list[Decimal]:
    history = []
    for offset in range(1, months + 1):
        month = finance.add_months(budget_month, -offset)
        start, end = finance.month_bounds(month)
        if end >= budget_month:
            continue
        total = db.scalar(
            select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                Transaction.user_id == user_id,
                Transaction.category_id == category_id,
                Transaction.type == "expense",
                Transaction.occurred_on >= start,
                Transaction.occurred_on <= end,
            )
        )
        value = dec(total)
        if value > 0:
            history.append(value)
    return history


def build_budget_out(
    db: Session, budget: Budget, today: date | None = None
) -> BudgetOut:
    today = today or date.today()
    start, end = finance.month_bounds(budget.month)
    spent = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == budget.user_id,
            Transaction.category_id == budget.category_id,
            Transaction.type == "expense",
            Transaction.occurred_on >= start,
            Transaction.occurred_on <= end,
        )
    )
    spent_dec = dec(spent)
    limit_dec = dec(budget.limit_amount)
    utilization = float(q(spent_dec / limit_dec * 100)) if limit_dec > 0 else 0.0
    status, threshold = finance.budget_status(
        utilization, budget.warning_threshold, budget.critical_threshold
    )
    history = budget_history(db, budget.user_id, budget.category_id, budget.month)
    risk = finance.budget_risk(spent_dec, limit_dec, budget.month, today, history)
    previous_start, previous_end = finance.month_bounds(finance.add_months(budget.month, -1))
    previous = db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == budget.user_id,
            Transaction.category_id == budget.category_id,
            Transaction.type == "expense",
            Transaction.occurred_on >= previous_start,
            Transaction.occurred_on <= previous_end,
        )
    )
    previous_dec = dec(previous)
    change = finance.percentage_change(spent_dec, previous_dec)

    category = budget.category
    return BudgetOut(
        id=budget.id,
        category=CategoryOut.model_validate(category),
        month=budget.month,
        limit_amount=limit_dec,
        warning_threshold=budget.warning_threshold,
        critical_threshold=budget.critical_threshold,
        actual_spend=spent_dec,
        remaining=q(max(limit_dec - spent_dec, ZERO)),
        utilization=utilization,
        status=status,
        threshold_crossed=threshold,
        projected_spend=risk.projected_spend,
        risk=BudgetRisk(
            projected_spend=risk.projected_spend,
            projected_utilization=risk.projected_utilization,
            risk_level=risk.risk_level,
            reliability=risk.reliability,
            elapsed_days=risk.elapsed_days,
            total_days=risk.total_days,
            remaining_days=risk.remaining_days,
            daily_burn=risk.daily_burn,
            history_months_used=risk.history_months_used,
            explanation=risk.explanation,
        ),
        previous_month_spend=previous_dec,
        change_vs_previous=change,
    )


def budgets_for_month(db: Session, user_id: int, month: date, today: date | None = None) -> list[BudgetOut]:
    month = date(month.year, month.month, 1)
    budgets = list(
        db.scalars(
            select(Budget)
            .options(joinedload(Budget.category))
            .where(Budget.user_id == user_id, Budget.month == month)
            .order_by(Budget.id)
        ).all()
    )
    return [build_budget_out(db, budget, today) for budget in budgets]


def goal_out(goal: SavingsGoal, today: date | None = None) -> GoalOut:
    today = today or date.today()
    contributions = [(c.contributed_on, dec(c.amount)) for c in goal.contributions]
    metrics = finance.goal_metrics(
        dec(goal.target_amount),
        contributions,
        today,
        goal.target_date,
        goal.created_at.date() if goal.created_at else None,
    )
    return GoalOut(
        id=goal.id,
        name=goal.name,
        target_amount=dec(goal.target_amount),
        saved_amount=metrics.saved,
        remaining_amount=metrics.remaining,
        target_date=goal.target_date,
        progress_percent=metrics.progress_percent,
        required_monthly=metrics.required_monthly,
        months_remaining=metrics.months_remaining,
        estimated_completion=metrics.estimated_completion,
        average_monthly_contribution=metrics.average_monthly_contribution,
        status=metrics.status,
        behind_by=metrics.behind_by,
        explanation=metrics.explanation,
        contributions=[
            ContributionOut(
                id=c.id,
                amount=dec(c.amount),
                contributed_on=c.contributed_on,
                note=c.note,
            )
            for c in sorted(goal.contributions, key=lambda c: c.contributed_on, reverse=True)
        ],
    )


def goals_for_user(db: Session, user_id: int, today: date | None = None) -> list[GoalOut]:
    goals = list(
        db.scalars(
            select(SavingsGoal)
            .options(selectinload(SavingsGoal.contributions))
            .where(SavingsGoal.user_id == user_id)
            .order_by(SavingsGoal.created_at)
        ).all()
    )
    return [goal_out(goal, today) for goal in goals]


def recent_transactions(txns: Sequence[Transaction], limit: int = 6) -> list[RecentTransaction]:
    result = []
    for txn in txns[:limit]:
        result.append(
            RecentTransaction(
                id=txn.id,
                type=txn.type,
                amount=dec(txn.amount),
                occurred_on=txn.occurred_on,
                merchant=txn.merchant,
                category_name=txn.category.name if txn.category else "Uncategorised",
                category_color=txn.category.color if txn.category else "#64748b",
                category_icon=txn.category.icon if txn.category else None,
                payment_method=txn.payment_method,
            )
        )
    return result


def notification_out(notification: Notification) -> NotificationOut:
    return NotificationOut(
        id=notification.id,
        category=notification.category,
        severity=notification.severity,
        title=notification.title,
        message=notification.message,
        amount=dec(notification.amount) if notification.amount is not None else None,
        trigger_reason=notification.trigger_reason,
        action_label=notification.action_label,
        action_url=notification.action_url,
        event_key=notification.event_key,
        is_read=notification.is_read,
        dismissed_at=notification.dismissed_at,
        scheduled_for=notification.scheduled_for,
        created_at=notification.created_at,
        deliveries=[
            {
                "channel": delivery.channel,
                "status": delivery.status,
                "attempted_at": delivery.attempted_at,
                "error": delivery.error,
            }
            for delivery in notification.deliveries
        ],
    )


def recent_notifications(db: Session, user_id: int, limit: int = 5) -> list[NotificationOut]:
    now = utcnow()
    notifications = db.scalars(
        select(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.dismissed_at.is_(None),
            (Notification.scheduled_for.is_(None) | (Notification.scheduled_for <= now)),
        )
        .order_by(Notification.created_at.desc())
        .limit(limit)
    ).all()
    return [notification_out(n) for n in notifications]


def build_insights(
    db: Session,
    user_id: int,
    budgets: Sequence[BudgetOut],
    goals: Sequence[GoalOut],
    current_txns: Sequence[Transaction],
    comparison_txns: Sequence[Transaction],
    today: date | None = None,
) -> list[InsightOut]:
    """Deterministic, rule-based insights. The LLM may explain but not override."""
    today = today or date.today()
    insights: list[InsightOut] = []

    for budget in budgets:
        if budget.status == "exceeded":
            insights.append(
                InsightOut(
                    rule_id="budget.exceeded",
                    severity="critical",
                    title=f"{budget.category.name} budget is over the limit",
                    explanation=(
                        f"Spent ₹{budget.actual_spend:,.2f} of ₹{budget.limit_amount:,.2f} "
                        f"({budget.utilization:.1f}%) this month."
                    ),
                    evidence=[
                        f"Category: {budget.category.name}",
                        f"Actual: ₹{budget.actual_spend:,.2f}",
                        f"Limit: ₹{budget.limit_amount:,.2f}",
                        f"Utilisation: {budget.utilization:.1f}%",
                    ],
                    metric=budget.actual_spend,
                    action_label="Review budget",
                    action_url="/budgets",
                )
            )
        elif budget.risk and budget.risk.risk_level in {"likely_over", "at_risk"}:
            insights.append(
                InsightOut(
                    rule_id="budget.projected_overrun",
                    severity="warning",
                    title=f"{budget.category.name} is projected to exceed budget",
                    explanation=(
                        f"At the current burn rate you may spend about ₹{budget.risk.projected_spend:,.2f} "
                        f"against a ₹{budget.limit_amount:,.2f} limit. Reliability: {budget.risk.reliability}."
                    ),
                    evidence=[
                        f"Projected utilisation: {budget.risk.projected_utilization:.1f}%",
                        f"Elapsed days: {budget.risk.elapsed_days} of {budget.risk.total_days}",
                        f"Daily burn: ₹{budget.risk.daily_burn:,.2f}",
                    ],
                    metric=budget.risk.projected_spend,
                    action_label="Simulate a change",
                    action_url="/scenarios",
                )
            )

    current_categories = {
        item.category_id: dec(item.amount) for item in category_breakdown(current_txns)
    }
    previous_categories = {
        item.category_id: dec(item.amount) for item in category_breakdown(comparison_txns)
    }
    categories = category_map(db)
    comparisons = []
    for category_id, amount in current_categories.items():
        previous = previous_categories.get(category_id, ZERO)
        change = finance.percentage_change(amount, previous)
        if change is not None and change > 20 and amount - previous >= Decimal("500"):
            comparisons.append((change, amount - previous, category_id, amount, previous))
    comparisons.sort(reverse=True, key=lambda item: item[1])
    for change, delta, category_id, amount, previous in comparisons[:2]:
        category = categories.get(category_id)
        if category is None:
            continue
        insights.append(
            InsightOut(
                rule_id="spending.category_increase",
                severity="warning",
                title=f"{category.name} spending is up {change:.0f}%",
                explanation=(
                    f"₹{amount:,.2f} in the selected period versus ₹{previous:,.2f} in the previous period "
                    f"(₹{delta:,.2f} more)."
                ),
                evidence=[
                    f"Category: {category.name}",
                    f"Current: ₹{amount:,.2f}",
                    f"Previous: ₹{previous:,.2f}",
                    f"Rule: increase above 20% and ₹500",
                ],
                metric=amount,
                action_label="View transactions",
                action_url=f"/transactions?category={category_id}",
            )
        )

    for goal in goals:
        if goal.status in {"behind", "at_risk"}:
            insights.append(
                InsightOut(
                    rule_id="goal.behind_schedule",
                    severity="warning" if goal.status == "behind" else "critical",
                    title=f"Savings goal behind: {goal.name}",
                    explanation=goal.explanation,
                    evidence=[
                        f"Saved: ₹{goal.saved_amount:,.2f} of ₹{goal.target_amount:,.2f}",
                        f"Progress: {goal.progress_percent:.1f}%",
                        f"Required monthly: ₹{goal.required_monthly:,.2f}"
                        if goal.required_monthly is not None
                        else "No target date",
                    ],
                    metric=goal.remaining_amount,
                    action_label="Review goal",
                    action_url="/goals",
                )
            )

    all_recent = txns_like(current_txns)
    recurring = finance.detect_recurring_payments(all_recent, today)
    for candidate in recurring[:1]:
        insights.append(
            InsightOut(
                rule_id="recurring.candidate",
                severity="info",
                title=f"Possible recurring payment: {candidate.merchant}",
                explanation=candidate.explanation,
                evidence=[
                    f"Occurrences: {candidate.occurrences}",
                    f"Average: ₹{candidate.average_amount:,.2f}",
                    f"Median interval: {candidate.interval_days:.0f} days",
                    f"Confidence: {candidate.confidence:.0%}",
                ],
                metric=candidate.average_amount,
                action_label="Inspect candidates",
                action_url="/analytics?tab=patterns",
            )
        )

    anomalies = finance.detect_anomalies(all_recent, today)
    for anomaly in anomalies[:1]:
        category = categories.get(anomaly.category_id)
        insights.append(
            InsightOut(
                rule_id="spending.unusual_transaction",
                severity="warning",
                title=f"Unusually large expense at {anomaly.merchant}",
                explanation=anomaly.explanation,
                evidence=[
                    f"Amount: ₹{anomaly.amount:,.2f}",
                    f"Category median: ₹{anomaly.median_amount:,.2f}",
                    f"Robust score: {anomaly.score:.1f} (threshold {anomaly.threshold:.1f})",
                    f"Category: {category.name if category else 'Unknown'}",
                ],
                metric=anomaly.amount,
                action_label="Review transaction",
                action_url=f"/transactions?flagged={anomaly.transaction_id}",
            )
        )

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    insights.sort(key=lambda item: severity_order.get(item.severity, 3))
    return insights[:6]
