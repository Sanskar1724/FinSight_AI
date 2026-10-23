"""Persistent notification engine.

Notifications are created from actual ledger values, deduplicated by a stable
event key, optionally deferred outside quiet hours, rate-limited, and linked to
the page where the user can act. The in-app channel is always persisted. Email
and browser push are represented by delivery records but require provider
configuration (not enabled in this prototype).
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Sequence
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import utcnow
from app.models import (
    AnomalyFeedback,
    Bill,
    Notification,
    NotificationDelivery,
    NotificationPreference,
    RecurringOverride,
    Transaction,
    User,
)
from app.services import finance
from app.services.finance import ZERO, q
from app.services.ledger import (
    budgets_for_month,
    category_breakdown,
    dec,
    goals_for_user,
    txns_between,
    txns_like,
)

MAX_PER_CATEGORY_PER_DAY = 6

PREFERENCE_FIELD = {
    "budget_threshold": "budget_warning_enabled",
    "budget_risk": "budget_warning_enabled",
    "unusual_spending": "unusual_spending_enabled",
    "recurring": "recurring_enabled",
    "bill_due": "bill_reminders_enabled",
    "goal_behind": "goal_enabled",
    "weekly_summary": "weekly_summary_enabled",
    "monthly_summary": "monthly_summary_enabled",
    "app_event": None,
}


def get_or_create_preferences(db: Session, user_id: int) -> NotificationPreference:
    preference = db.scalar(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    if preference is None:
        preference = NotificationPreference(user_id=user_id)
        db.add(preference)
        db.flush()
    return preference


def _configured(notification_type: str, preference: NotificationPreference) -> bool:
    field = PREFERENCE_FIELD.get(notification_type)
    if field is None:
        return True
    return bool(getattr(preference, field))


def _parse_clock(value: str) -> time | None:
    try:
        hour, minute = value.split(":")
        return time(int(hour), int(minute))
    except (ValueError, TypeError):
        return None


def in_quiet_hours(preference: NotificationPreference, local_now: datetime) -> bool:
    if not preference.quiet_hours_enabled:
        return False
    start = _parse_clock(preference.quiet_start)
    end = _parse_clock(preference.quiet_end)
    if start is None or end is None:
        return False
    current = local_now.time()
    if start == end:
        return False
    if start < end:
        return start <= current < end
    return current >= start or current < end


def quiet_hours_end(preference: NotificationPreference, local_now: datetime) -> datetime:
    end = _parse_clock(preference.quiet_end) or time(7, 0)
    candidate = datetime.combine(local_now.date(), end, tzinfo=local_now.tzinfo)
    if candidate <= local_now:
        candidate += timedelta(days=1)
    return candidate


def _scheduled_for(preference: NotificationPreference, local_now: datetime) -> datetime | None:
    if not in_quiet_hours(preference, local_now):
        return None
    return quiet_hours_end(preference, local_now).astimezone(timezone.utc).replace(tzinfo=None)


def _local_now() -> datetime:
    try:
        tz = ZoneInfo(settings.timezone)
    except ZoneInfoNotFoundError:
        tz = timezone.utc
    return datetime.now(tz)


def _rate_limited(db: Session, user_id: int, category: str, now: datetime) -> bool:
    since = now - timedelta(days=1)
    count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.category == category,
            Notification.created_at >= since,
        )
    )
    return int(count or 0) >= MAX_PER_CATEGORY_PER_DAY


def _add_notification(
    db: Session,
    user_id: int,
    preference: NotificationPreference,
    *,
    notification_type: str,
    title: str,
    message: str,
    trigger_reason: str,
    event_key: str,
    severity: str = "info",
    amount: Decimal | None = None,
    action_label: str | None = None,
    action_url: str | None = None,
    local_now: datetime | None = None,
    skip_preference_check: bool = False,
) -> Notification | None:
    if not skip_preference_check and not _configured(notification_type, preference):
        return None
    existing = db.scalar(
        select(Notification).where(
            Notification.user_id == user_id, Notification.event_key == event_key
        )
    )
    if existing is not None:
        return None
    local_now = local_now or _local_now()
    if _rate_limited(db, user_id, notification_type, utcnow()):
        return None
    scheduled_for = _scheduled_for(preference, local_now)
    notification = Notification(
        user_id=user_id,
        category=notification_type,
        severity=severity,
        title=title,
        message=message,
        amount=q(amount) if amount is not None else None,
        trigger_reason=trigger_reason,
        action_label=action_label,
        action_url=action_url,
        event_key=event_key,
        scheduled_for=scheduled_for,
    )
    db.add(notification)
    db.flush()
    db.add(
        NotificationDelivery(
            notification_id=notification.id,
            channel="in_app",
            status="queued" if scheduled_for else "delivered",
            error=None,
        )
    )
    return notification


def create_app_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    event_key: str,
    severity: str = "info",
    action_label: str | None = None,
    action_url: str | None = None,
) -> Notification | None:
    preference = get_or_create_preferences(db, user_id)
    return _add_notification(
        db,
        user_id,
        preference,
        notification_type="app_event",
        title=title,
        message=message,
        trigger_reason="Application event",
        event_key=event_key,
        severity=severity,
        action_label=action_label,
        action_url=action_url,
        skip_preference_check=True,
    )


def evaluate_notifications(
    db: Session, user: User, now: datetime | None = None, force: bool = False
) -> dict:
    """Evaluate all notification rules idempotently.

    ``force`` additionally generates weekly/monthly summaries regardless of the
    calendar day. It never bypasses opt-outs or quiet hours.
    """
    preference = get_or_create_preferences(db, user.id)
    local_now = now or _local_now()
    if local_now.tzinfo is None:
        local_now = local_now.replace(tzinfo=ZoneInfo(settings.timezone))
    today = local_now.date()
    current_month = date(today.year, today.month, 1)
    created = 0
    skipped = 0
    messages: list[str] = []

    def record(result: Notification | None, label: str) -> None:
        nonlocal created, skipped
        if result is not None:
            created += 1
            messages.append(label)
        else:
            skipped += 1

    budgets = budgets_for_month(db, user.id, current_month, today)
    for budget in budgets:
        threshold = preference.warning_threshold
        critical = preference.critical_threshold
        if budget.utilization >= 100:
            record(
                _add_notification(
                    db,
                    user.id,
                    preference,
                    notification_type="budget_threshold",
                    severity="critical",
                    title=f"{budget.category.name} budget exceeded",
                    message=(
                        f"You have spent ₹{budget.actual_spend:,.2f} of your "
                        f"₹{budget.limit_amount:,.2f} {budget.category.name.lower()} budget "
                        f"({budget.utilization:.1f}%)."
                    ),
                    trigger_reason=(
                        f"Actual spend crossed 100% of the limit for {budget.month:%B %Y}."
                    ),
                    event_key=f"budget_exceeded:{budget.id}:{budget.month.isoformat()}",
                    amount=budget.actual_spend,
                    action_label="Review spending",
                    action_url="/budgets",
                    local_now=local_now,
                ),
                f"{budget.category.name} exceeded budget",
            )
        elif budget.utilization >= critical:
            record(
                _add_notification(
                    db,
                    user.id,
                    preference,
                    notification_type="budget_threshold",
                    severity="critical",
                    title=f"{budget.category.name} budget is nearly used up",
                    message=(
                        f"You have used ₹{budget.actual_spend:,.2f} of your "
                        f"₹{budget.limit_amount:,.2f} {budget.category.name.lower()} budget "
                        f"({budget.utilization:.1f}%)."
                    ),
                    trigger_reason=(
                        f"Configured critical threshold of {critical}% crossed for "
                        f"{budget.month:%B %Y}."
                    ),
                    event_key=f"budget_critical:{budget.id}:{budget.month.isoformat()}",
                    amount=budget.actual_spend,
                    action_label="Review budget",
                    action_url="/budgets",
                    local_now=local_now,
                ),
                f"{budget.category.name} crossed the critical budget threshold",
            )
        elif budget.utilization >= threshold:
            record(
                _add_notification(
                    db,
                    user.id,
                    preference,
                    notification_type="budget_threshold",
                    severity="warning",
                    title=f"{budget.category.name} budget is approaching its limit",
                    message=(
                        f"You have used ₹{budget.actual_spend:,.2f} of your "
                        f"₹{budget.limit_amount:,.2f} {budget.category.name.lower()} budget "
                        f"({budget.utilization:.1f}%)."
                    ),
                    trigger_reason=(
                        f"Configured warning threshold of {threshold}% crossed for "
                        f"{budget.month:%B %Y}."
                    ),
                    event_key=f"budget_warning:{budget.id}:{budget.month.isoformat()}",
                    amount=budget.actual_spend,
                    action_label="Review budget",
                    action_url="/budgets",
                    local_now=local_now,
                ),
                f"{budget.category.name} crossed the warning threshold",
            )

        if (
            budget.risk is not None
            and budget.risk.risk_level in {"at_risk", "likely_over"}
            and budget.actual_spend < budget.limit_amount
        ):
            record(
                _add_notification(
                    db,
                    user.id,
                    preference,
                    notification_type="budget_risk",
                    severity="warning",
                    title=f"{budget.category.name} is projected to exceed budget",
                    message=(
                        f"At the current burn rate, spending may reach about "
                        f"₹{budget.risk.projected_spend:,.2f} against a "
                        f"₹{budget.limit_amount:,.2f} limit. Reliability: {budget.risk.reliability}."
                    ),
                    trigger_reason=(
                        f"Burn-rate projection uses {budget.risk.elapsed_days} elapsed days and "
                        f"{budget.risk.history_months_used} historical month(s)."
                    ),
                    event_key=f"budget_risk:{budget.id}:{budget.month.isoformat()}",
                    amount=budget.risk.projected_spend,
                    action_label="Run a scenario",
                    action_url="/analytics?tab=scenarios",
                    local_now=local_now,
                ),
                f"{budget.category.name} projected overrun",
            )

    history_txns = txns_between(db, user.id, today - timedelta(days=220), today)
    anomalies = finance.detect_anomalies(txns_like(history_txns), today)
    feedback = {
        row.transaction_id: row.status
        for row in db.scalars(
            select(AnomalyFeedback).where(AnomalyFeedback.user_id == user.id)
        ).all()
    }
    categories = {item.category_id: item for item in category_breakdown(history_txns)}
    txn_merchants = {txn.id: txn for txn in history_txns}
    for anomaly in anomalies:
        if anomaly.transaction_id in feedback:
            continue
        category_name = categories.get(anomaly.category_id)
        record(
            _add_notification(
                db,
                user.id,
                preference,
                notification_type="unusual_spending",
                severity="warning",
                title=f"Unusually large expense at {anomaly.merchant}",
                message=(
                    f"₹{anomaly.amount:,.2f} on {anomaly.occurred_on:%d %b} is well above the "
                    f"{category_name.name if category_name else 'category'} median of "
                    f"₹{anomaly.median_amount:,.2f}. This is an indicator, not a fraud finding."
                ),
                trigger_reason=(
                    f"Robust modified z-score {anomaly.score:.1f} exceeded the "
                    f"{anomaly.threshold:.1f} threshold using {anomaly.sample_size} prior transactions."
                ),
                event_key=f"anomaly:{anomaly.transaction_id}",
                amount=anomaly.amount,
                action_label="Review transaction",
                action_url=f"/transactions?flagged={anomaly.transaction_id}",
                local_now=local_now,
            ),
            f"Anomaly at {anomaly.merchant}",
        )

    recurring = finance.detect_recurring_payments(txns_like(history_txns), today)
    overrides = {
        row.merchant_key: row.status
        for row in db.scalars(
            select(RecurringOverride).where(RecurringOverride.user_id == user.id)
        ).all()
    }
    for candidate in recurring:
        if candidate.confidence < 0.5 or overrides.get(candidate.merchant_key) == "dismissed":
            continue
        record(
            _add_notification(
                db,
                user.id,
                preference,
                notification_type="recurring",
                severity="info",
                title=f"Possible recurring payment: {candidate.merchant}",
                message=(
                    f"{candidate.occurrences} payments averaging ₹{candidate.average_amount:,.2f} "
                    f"look {candidate.frequency}. Confirm it in Analytics if correct."
                ),
                trigger_reason=(
                    f"Merchant, category, amount similarity and {candidate.interval_days:.0f}-day "
                    f"median interval; confidence {candidate.confidence:.0%}."
                ),
                event_key=f"recurring:{candidate.merchant_key}:{current_month.isoformat()}",
                amount=candidate.average_amount,
                action_label="Inspect candidates",
                action_url="/analytics?tab=recurring",
                local_now=local_now,
            ),
            f"Recurring candidate: {candidate.merchant}",
        )

    bills = db.scalars(
        select(Bill).where(
            Bill.user_id == user.id,
            Bill.is_paid.is_(False),
            Bill.due_date >= today - timedelta(days=7),
            Bill.due_date <= today + timedelta(days=7),
        )
    ).all()
    for bill in bills:
        days_left = (bill.due_date - today).days
        if days_left < 0:
            title = f"{bill.name} is overdue"
            timing = f"was due {abs(days_left)} day(s) ago"
            severity = "critical"
        else:
            title = f"{bill.name} due soon"
            timing = f"is due in {days_left} day(s)" if days_left else "is due today"
            severity = "warning" if days_left <= 3 else "info"
        record(
            _add_notification(
                db,
                user.id,
                preference,
                notification_type="bill_due",
                severity=severity,
                title=title,
                message=f"Your user-entered bill of ₹{dec(bill.amount):,.2f} {timing} ({bill.due_date:%d %b}).",
                trigger_reason="User-entered bill due-date rule (7-day window).",
                event_key=f"bill:{bill.id}:{bill.due_date.isoformat()}",
                amount=dec(bill.amount),
                action_label="Manage bills",
                action_url="/notifications?tab=bills",
                local_now=local_now,
            ),
            f"Bill reminder: {bill.name}",
        )

    goals = goals_for_user(db, user.id, today)
    for goal in goals:
        if goal.status not in {"behind", "at_risk"}:
            continue
        record(
            _add_notification(
                db,
                user.id,
                preference,
                notification_type="goal_behind",
                severity="warning" if goal.status == "behind" else "critical",
                title=f"Savings goal behind schedule: {goal.name}",
                message=(
                    f"₹{goal.saved_amount:,.2f} saved of ₹{goal.target_amount:,.2f}. "
                    f"About ₹{goal.required_monthly:,.2f} per month is needed."
                    if goal.required_monthly is not None
                    else goal.explanation
                ),
                trigger_reason=(
                    f"Contribution pace is below the linear schedule. Status: {goal.status}."
                ),
                event_key=f"goal_behind:{goal.id}:{current_month.isoformat()}",
                amount=goal.remaining_amount,
                action_label="Review goal",
                action_url="/goals",
                local_now=local_now,
            ),
            f"Goal behind: {goal.name}",
        )

    should_weekly = force or (local_now.weekday() == 0 and local_now.hour >= 8)
    if should_weekly and preference.weekly_summary_enabled:
        week_start = today - timedelta(days=6)
        previous_start = week_start - timedelta(days=7)
        previous_end = week_start - timedelta(days=1)
        week_txns = txns_between(db, user.id, week_start, today)
        prev_txns = txns_between(db, user.id, previous_start, previous_end)
        week_spend = q(sum((dec(t.amount) for t in week_txns if t.type == "expense"), ZERO))
        prev_spend = q(sum((dec(t.amount) for t in prev_txns if t.type == "expense"), ZERO))
        change = finance.percentage_change(week_spend, prev_spend)
        comparison = (
            f"That is {abs(change):.0f}% {'more' if change >= 0 else 'less'} than the previous 7 days."
            if change is not None
            else "No comparable previous-week spending."
        )
        iso_week = today.isocalendar()
        record(
            _add_notification(
                db,
                user.id,
                preference,
                notification_type="weekly_summary",
                severity="info",
                title="Your weekly spending summary",
                message=(
                    f"You spent ₹{week_spend:,.2f} over the last 7 days across "
                    f"{sum(1 for t in week_txns if t.type == 'expense')} expense transactions. "
                    + comparison
                ),
                trigger_reason="Weekly summary scheduled on Monday or requested manually.",
                event_key=f"weekly_summary:{iso_week.year}-W{iso_week.week:02d}",
                amount=week_spend,
                action_label="Open analytics",
                action_url="/analytics",
                local_now=local_now,
            ),
            "Weekly summary",
        )
    elif not preference.weekly_summary_enabled:
        skipped += 1

    previous_month = finance.add_months(current_month, -1)
    should_monthly = force or today.day <= 2
    if should_monthly and preference.monthly_summary_enabled:
        p_start, p_end = finance.month_bounds(previous_month)
        month_txns = txns_between(db, user.id, p_start, p_end)
        flow = finance.cash_flow(txns_like(month_txns))
        top = category_breakdown(month_txns)[:1]
        top_text = (
            f" The largest category was {top[0].name} at ₹{top[0].amount:,.2f}."
            if top
            else ""
        )
        record(
            _add_notification(
                db,
                user.id,
                preference,
                notification_type="monthly_summary",
                severity="info",
                title=f"Your {previous_month:%B %Y} financial summary",
                message=(
                    f"Income was ₹{flow.income:,.2f}, expenses were ₹{flow.expenses:,.2f}, "
                    f"and net cash flow was ₹{flow.net:,.2f}.{top_text}"
                ),
                trigger_reason="Monthly summary generated from complete previous-month records.",
                event_key=f"monthly_summary:{previous_month.isoformat()}",
                amount=flow.net,
                action_label="Open dashboard",
                action_url=f"/?start={p_start.isoformat()}&end={p_end.isoformat()}",
                local_now=local_now,
            ),
            "Monthly summary",
        )
    elif not preference.monthly_summary_enabled:
        skipped += 1

    db.commit()
    return {"created": created, "skipped": skipped, "messages": messages}


def available_notifications(
    db: Session, user_id: int, include_dismissed: bool = False
) -> Sequence[Notification]:
    now = utcnow()
    statement = select(Notification).where(
        Notification.user_id == user_id,
        Notification.scheduled_for.is_(None) | (Notification.scheduled_for <= now),
    )
    if not include_dismissed:
        statement = statement.where(Notification.dismissed_at.is_(None))
    return list(db.scalars(statement.order_by(Notification.created_at.desc())).all())
