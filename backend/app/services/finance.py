"""Deterministic financial calculations.

This module intentionally has no dependency on SQLAlchemy or the LLM. Route
handlers adapt database rows to these functions so that every displayed figure
can be traced to a tested formula.

Money is handled as :class:`decimal.Decimal` and quantised to paise at the
boundary. All functions are pure unless explicitly noted.
"""

from __future__ import annotations

import calendar
import math
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from statistics import median
from typing import Iterable, Sequence

TWO_PLACES = Decimal("0.01")
ZERO = Decimal("0.00")
DAYS_PER_MONTH = Decimal("30.44")
MAD_SCALE = Decimal("0.6745")
RECURRING_TOLERANCE = 0.35


def q(value: Decimal | float | int | str) -> Decimal:
    """Quantise to two decimal places with commercial rounding."""
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def format_inr(value: Decimal | float | int, symbol: bool = True) -> str:
    """Indian digit grouping, e.g. 125000 -> ``₹1,25,000.00``."""
    amount = q(value)
    negative = amount < 0
    integer_part, decimal_part = f"{abs(amount):.2f}".split(".")
    if len(integer_part) > 3:
        last_three = integer_part[-3:]
        rest = integer_part[:-3]
        groups: list[str] = []
        while len(rest) > 2:
            groups.insert(0, rest[-2:])
            rest = rest[:-2]
        if rest:
            groups.insert(0, rest)
        integer_part = ",".join(groups) + "," + last_three
    sign = "-" if negative else ""
    prefix = "₹" if symbol else ""
    return f"{sign}{prefix}{integer_part}.{decimal_part}"


def safe_ratio(numerator: Decimal, denominator: Decimal) -> float | None:
    if denominator == 0:
        return None
    return float(q(numerator / denominator * 100))


def percentage_change(current: Decimal, baseline: Decimal | None) -> float | None:
    """Return percentage change or ``None`` when the baseline is unusable.

    A zero or negative baseline makes a conventional percentage change
    meaningless. We return ``None`` instead of infinity or a sign-flipped
    figure and the UI labels it as "not comparable".
    """
    if baseline is None or baseline <= 0:
        return None
    return float(q((current - baseline) / baseline * 100))


def previous_period(start: date, end: date) -> tuple[date, date]:
    """Immediately preceding period of the same inclusive length."""
    length = (end - start).days + 1
    previous_end = start - timedelta(days=1)
    return previous_end - timedelta(days=length - 1), previous_end


def add_months(month: date, offset: int) -> date:
    base = date(month.year, month.month, 1)
    total = base.year * 12 + (base.month - 1) + offset
    year, month_index = divmod(total, 12)
    return date(year, month_index + 1, 1)


def month_bounds(month: date) -> tuple[date, date]:
    start = date(month.year, month.month, 1)
    last_day = calendar.monthrange(start.year, start.month)[1]
    return start, date(start.year, start.month, last_day)


def month_key(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def month_label(value: date) -> str:
    return value.strftime("%b %Y")


def month_key_date(key: str) -> date:
    year, month = key.split("-")
    return date(int(year), int(month), 1)


def months_between(start: date, end: date) -> list[date]:
    start = date(start.year, start.month, 1)
    end = date(end.year, end.month, 1)
    if end < start:
        return []
    result: list[date] = []
    cursor = start
    while cursor <= end:
        result.append(cursor)
        cursor = add_months(cursor, 1)
    return result


@dataclass(frozen=True)
class TxnLike:
    """Minimal transaction shape accepted by the engine."""

    id: int
    type: str
    amount: Decimal
    occurred_on: date
    category_id: int
    merchant: str


@dataclass(frozen=True)
class MonthlyBaseline:
    category_spend: dict[int, Decimal]
    income: Decimal
    months: tuple[date, ...]

    @property
    def months_used(self) -> int:
        return len(self.months)


def average_monthly_baseline(
    transactions: Sequence[TxnLike], start: date, end: date
) -> MonthlyBaseline:
    """Average category spend and income across observed months.

    A month is observed when it contains at least one transaction. Months with
    no transactions are excluded rather than treated as zero because the ledger
    cannot distinguish missing records from months with no spending. Within an
    observed month, a category without spending contributes zero because the
    denominator is the number of observed months.
    """
    in_range = [txn for txn in transactions if start <= txn.occurred_on <= end]
    months = sorted(
        {date(txn.occurred_on.year, txn.occurred_on.month, 1) for txn in in_range}
    )
    if not months:
        return MonthlyBaseline(category_spend={}, income=ZERO, months=())

    category_totals: dict[int, Decimal] = defaultdict(lambda: ZERO)
    income_total = ZERO
    for txn in in_range:
        amount = q(txn.amount)
        if txn.type == "expense":
            category_totals[txn.category_id] += amount
        elif txn.type == "income":
            income_total += amount

    divisor = Decimal(len(months))
    return MonthlyBaseline(
        category_spend={
            category_id: q(total / divisor)
            for category_id, total in category_totals.items()
        },
        income=q(income_total / divisor),
        months=tuple(months),
    )


@dataclass
class CashFlow:
    income: Decimal
    expenses: Decimal
    net: Decimal
    savings_rate: float | None
    transaction_count: int


@dataclass
class BudgetRiskResult:
    projected_spend: Decimal
    projected_utilization: float
    risk_level: str
    reliability: str
    elapsed_days: int
    total_days: int
    remaining_days: int
    daily_burn: Decimal
    history_months_used: int
    explanation: str


@dataclass
class GoalMetrics:
    saved: Decimal
    remaining: Decimal
    progress_percent: float
    required_monthly: Decimal | None
    months_remaining: int | None
    estimated_completion: date | None
    average_monthly_contribution: Decimal
    status: str
    behind_by: Decimal | None
    explanation: str


@dataclass
class Anomaly:
    transaction_id: int
    merchant: str
    category_id: int
    amount: Decimal
    occurred_on: date
    median_amount: Decimal
    mad_amount: Decimal
    score: float
    threshold: float
    sample_size: int
    explanation: str


@dataclass
class RecurringCandidate:
    merchant_key: str
    merchant: str
    category_id: int
    average_amount: Decimal
    last_amount: Decimal
    frequency: str
    interval_days: float
    occurrences: int
    last_seen: date
    next_expected: date | None
    confidence: float
    explanation: str


@dataclass
class ForecastResult:
    predicted: Decimal
    lower: Decimal
    upper: Decimal
    method: str
    months_used: list[str]
    assumptions: list[str]


@dataclass
class Backtest:
    method: str
    mae: float | None
    mape: float | None
    sample_size: int
    baseline_method: str
    baseline_mae: float | None
    note: str


# ---------------------------------------------------------------------------
# Cash flow
# ---------------------------------------------------------------------------
def cash_flow(transactions: Iterable[TxnLike]) -> CashFlow:
    income = ZERO
    expenses = ZERO
    count = 0
    for txn in transactions:
        count += 1
        if txn.type == "income":
            income += txn.amount
        else:
            expenses += txn.amount
    income = q(income)
    expenses = q(expenses)
    net = q(income - expenses)
    savings_rate = None
    if income > 0:
        savings_rate = float(q(net / income * 100))
    return CashFlow(income, expenses, net, savings_rate, count)


def category_totals(transactions: Iterable[TxnLike]) -> dict[int, Decimal]:
    totals: dict[int, Decimal] = defaultdict(lambda: ZERO)
    for txn in transactions:
        if txn.type == "expense":
            totals[txn.category_id] += txn.amount
    return {key: q(value) for key, value in totals.items()}


def monthly_totals(
    transactions: Iterable[TxnLike], start_month: date, end_month: date
) -> list[dict]:
    buckets: dict[str, dict[str, Decimal]] = {}
    for month in months_between(start_month, end_month):
        buckets[month_key(month)] = {"income": ZERO, "expenses": ZERO, "count": Decimal(0)}
    for txn in transactions:
        key = month_key(txn.occurred_on)
        if key not in buckets:
            continue
        if txn.type == "income":
            buckets[key]["income"] += txn.amount
        else:
            buckets[key]["expenses"] += txn.amount
        buckets[key]["count"] += 1
    result = []
    for month in months_between(start_month, end_month):
        key = month_key(month)
        values = buckets[key]
        income = q(values["income"])
        expenses = q(values["expenses"])
        net = q(income - expenses)
        rate = float(q(net / income * 100)) if income > 0 else None
        result.append(
            {
                "month": key,
                "month_date": month,
                "income": income,
                "expenses": expenses,
                "net": net,
                "savings_rate": rate,
                "count": int(values["count"]),
            }
        )
    return result


# ---------------------------------------------------------------------------
# Budget risk
# ---------------------------------------------------------------------------
def budget_risk(
    spent: Decimal,
    limit_amount: Decimal,
    month: date,
    today: date,
    historical_monthly_spend: Sequence[Decimal] | None = None,
) -> BudgetRiskResult:
    """Estimate month-end spend using burn rate and comparable history.

    Formula (current month): projection = 0.6 * (spent / elapsed_days *
    days_in_month) + 0.4 * mean(comparable full-month history). For completed
    months the projection is the actual spend. This is a simple estimate, not a
    statistically validated forecast, and the reliability label says so.
    """
    start, end = month_bounds(month)
    total_days = (end - start).days + 1
    if today < start:
        elapsed = 0
    elif today > end:
        elapsed = total_days
    else:
        elapsed = today.day
    remaining_days = max(0, total_days - elapsed)
    history = [q(x) for x in (historical_monthly_spend or []) if x > 0]
    history_months = len(history)
    daily_burn = q(spent / Decimal(elapsed)) if elapsed > 0 else ZERO

    if today > end:
        projected = q(spent)
        reliability = "high"
    elif elapsed == 0:
        projected = ZERO
        reliability = "low"
    else:
        burn_projection = daily_burn * total_days
        if history:
            historical_mean = q(sum(history) / Decimal(len(history)))
            projected = q(burn_projection * Decimal("0.6") + historical_mean * Decimal("0.4"))
        else:
            projected = q(burn_projection)
        if elapsed >= 14 and history_months >= 2:
            reliability = "high"
        elif elapsed >= 7 or history_months >= 1:
            reliability = "medium"
        else:
            reliability = "low"

    projected_utilization = float(q(projected / limit_amount * 100)) if limit_amount > 0 else 0.0
    if today > end and spent > limit_amount:
        risk_level = "over"
    elif projected > limit_amount * Decimal("1.25"):
        risk_level = "likely_over"
    elif projected > limit_amount:
        risk_level = "at_risk"
    elif projected > limit_amount * Decimal("0.85"):
        risk_level = "watch"
    else:
        risk_level = "on_track"

    if today > end:
        explanation = (
            f"You spent ₹{q(spent):,.2f} of a ₹{q(limit_amount):,.2f} budget in {month_label(month)}."
        )
    elif elapsed == 0:
        explanation = f"{month_label(month)} has not started yet. No spend has been recorded."
    else:
        explanation = (
            f"With ₹{q(spent):,.2f} spent over {elapsed} of {total_days} days, the daily burn is "
            f"₹{q(daily_burn):,.2f}. Blending burn rate with {history_months} comparable "
            f"month(s) projects ₹{q(projected):,.2f}, or {projected_utilization:.1f}% of the limit. "
            f"Reliability: {reliability}. This is an estimate, not a guarantee."
        )

    return BudgetRiskResult(
        projected_spend=projected,
        projected_utilization=projected_utilization,
        risk_level=risk_level,
        reliability=reliability,
        elapsed_days=elapsed,
        total_days=total_days,
        remaining_days=remaining_days,
        daily_burn=daily_burn,
        history_months_used=history_months,
        explanation=explanation,
    )


def budget_status(utilization: float, warning: int, critical: int) -> tuple[str, str | None]:
    if utilization > 100:
        return "exceeded", "exceeded"
    if utilization >= critical:
        return "critical", "critical"
    if utilization >= warning:
        return "approaching", "warning"
    return "healthy", None


# ---------------------------------------------------------------------------
# Savings goals
# ---------------------------------------------------------------------------
def goal_metrics(
    target_amount: Decimal,
    contributions: Sequence[tuple[date, Decimal]],
    today: date,
    target_date: date | None,
    start_date: date | None = None,
) -> GoalMetrics:
    saved = q(sum((amount for _, amount in contributions), ZERO))
    remaining = q(max(target_amount - saved, ZERO))
    progress = float(min(Decimal("100"), q(saved / target_amount * 100))) if target_amount > 0 else 0.0

    recent_cutoff = today - timedelta(days=91)
    recent = [amount for day, amount in contributions if day >= recent_cutoff]
    average_monthly = q(sum(recent, ZERO) / Decimal(3)) if recent else ZERO

    months_remaining: int | None = None
    required_monthly: Decimal | None = None
    if target_date is not None:
        if target_date <= today:
            months_remaining = 0
        else:
            months_remaining = max(1, math.ceil((target_date - today).days / 30.44))
        required_monthly = q(remaining / Decimal(months_remaining)) if months_remaining > 0 else remaining

    estimated_completion: date | None = None
    if remaining == 0:
        estimated_completion = today
    elif average_monthly > 0:
        months_needed = int(math.ceil(float(remaining / average_monthly)))
        estimated_completion = today + timedelta(days=round(months_needed * 30.44))

    if remaining == 0:
        status = "achieved"
        behind_by = ZERO
        explanation = f"Goal reached: ₹{saved:,.2f} saved against a ₹{target_amount:,.2f} target."
    elif target_date is None:
        status = "no_date"
        behind_by = None
        explanation = (
            f"₹{remaining:,.2f} remains. Add a target date to calculate a required monthly contribution."
        )
    elif target_date <= today:
        status = "at_risk"
        behind_by = remaining
        explanation = (
            f"The target date has passed with ₹{remaining:,.2f} still to save. "
            "Set a new date or adjust the target."
        )
    else:
        assert months_remaining is not None
        scheduled_start = start_date or (min((day for day, _ in contributions), default=today))
        elapsed_days = max(0, (today - scheduled_start).days)
        total_days = max(1, (target_date - scheduled_start).days)
        expected_progress = min(1.0, elapsed_days / total_days)
        expected_saved = q(target_amount * Decimal(str(expected_progress)))
        behind_amount = q(max(expected_saved - saved, ZERO))
        behind_by = behind_amount
        behind = progress / 100 + 0.03 < expected_progress
        insufficient_pace = average_monthly > 0 and required_monthly is not None and average_monthly < required_monthly
        if behind or insufficient_pace:
            status = "behind"
        elif target_date - today <= timedelta(days=60) and required_monthly is not None and average_monthly < required_monthly:
            status = "at_risk"
        else:
            status = "on_track"
        explanation = (
            f"₹{remaining:,.2f} remains over {months_remaining} month(s), requiring about "
            f"₹{required_monthly:,.2f} per month. Your recent average contribution is "
            f"₹{average_monthly:,.2f}. "
            + ("You are behind the linear schedule." if status == "behind" else "You are on or ahead of schedule.")
        )

    return GoalMetrics(
        saved=saved,
        remaining=remaining,
        progress_percent=progress,
        required_monthly=required_monthly,
        months_remaining=months_remaining,
        estimated_completion=estimated_completion,
        average_monthly_contribution=average_monthly,
        status=status,
        behind_by=behind_by,
        explanation=explanation,
    )


# ---------------------------------------------------------------------------
# Rolling forecast and backtest
# ---------------------------------------------------------------------------
def _expense_month_series(
    transactions: Iterable[TxnLike], start_month: date, end_month: date, category_id: int | None = None
) -> list[tuple[date, Decimal]]:
    totals: dict[str, Decimal] = {month_key(m): ZERO for m in months_between(start_month, end_month)}
    for txn in transactions:
        if txn.type != "expense":
            continue
        if category_id is not None and txn.category_id != category_id:
            continue
        key = month_key(txn.occurred_on)
        if key in totals:
            totals[key] += txn.amount
    return [(month_key_date(key), q(value)) for key, value in sorted(totals.items())]


def rolling_average_forecast(
    transactions: Iterable[TxnLike],
    as_of: date,
    window: int = 3,
    category_id: int | None = None,
) -> ForecastResult:
    """Forecast next month from the last ``window`` *complete* calendar months."""
    current_month = date(as_of.year, as_of.month, 1)
    end_month = add_months(current_month, -1)
    start_month = add_months(end_month, -(window - 1))
    series = _expense_month_series(transactions, start_month, end_month, category_id)
    values = [value for _, value in series]
    if not values or all(value == 0 for value in values):
        return ForecastResult(
            predicted=ZERO,
            lower=ZERO,
            upper=ZERO,
            method="rolling_average",
            months_used=[],
            assumptions=[
                "No complete months of expense data are available, so the forecast is ₹0.",
                "The current partial month is excluded to avoid understating the forecast.",
            ],
        )
    predicted = q(sum(values, ZERO) / Decimal(len(values)))
    backtest = backtest_rolling_average(transactions, as_of, window, category_id)
    if backtest.mae is not None and backtest.sample_size >= 3:
        band = Decimal(str(backtest.mae)) * Decimal("1.28")
        band_label = "±1.28 × mean absolute error from the time-aware backtest"
    else:
        band = predicted * Decimal("0.25")
        band_label = "±25% heuristic band because fewer than 3 backtest points exist"
    lower = q(max(ZERO, predicted - band))
    upper = q(predicted + band)
    months_used = [month_key(month) for month, _ in series]
    return ForecastResult(
        predicted=predicted,
        lower=lower,
        upper=upper,
        method="rolling_average",
        months_used=months_used,
        assumptions=[
            f"Next-month expense forecast is the mean of the last {len(values)} complete month(s): "
            + ", ".join(f"{month_label(month)} ₹{value:,.2f}" for month, value in series)
            + ".",
            f"Uncertainty band is {band_label}.",
            "The current partial month is excluded. Only data on or before the forecast date is used.",
            "This is a transparent baseline, not a promise of future spending.",
        ],
    )


def backtest_rolling_average(
    transactions: Iterable[TxnLike], as_of: date, window: int = 3, category_id: int | None = None
) -> Backtest:
    """Time-aware backtest over complete months only (no future leakage)."""
    txns = list(transactions)
    if not txns:
        return Backtest(
            method=f"rolling_average_{window}m",
            mae=None,
            mape=None,
            sample_size=0,
            baseline_method="naive_last_month",
            baseline_mae=None,
            note="No data available for a backtest.",
        )
    earliest = min(t.occurred_on for t in txns)
    current_month = date(as_of.year, as_of.month, 1)
    start_month = date(earliest.year, earliest.month, 1)
    # Do not evaluate a partial month.
    end_month = add_months(current_month, -1)
    if end_month < start_month:
        return Backtest(
            method=f"rolling_average_{window}m",
            mae=None,
            mape=None,
            sample_size=0,
            baseline_method="naive_last_month",
            baseline_mae=None,
            note="Fewer than two complete months of data; backtest not possible.",
        )
    series = _expense_month_series(txns, start_month, end_month, category_id)
    values = [float(v) for _, v in series]
    errors: list[float] = []
    pct_errors: list[float] = []
    baseline_errors: list[float] = []
    for index in range(window, len(values)):
        prediction = sum(values[index - window : index]) / window
        baseline = values[index - 1]
        actual = values[index]
        errors.append(abs(prediction - actual))
        baseline_errors.append(abs(baseline - actual))
        if actual > 0:
            pct_errors.append(abs(prediction - actual) / actual * 100)
    if not errors:
        return Backtest(
            method=f"rolling_average_{window}m",
            mae=None,
            mape=None,
            sample_size=0,
            baseline_method="naive_last_month",
            baseline_mae=None,
            note=(
                f"At least {window + 1} complete months are needed. "
                "No evaluation is shown rather than a fabricated score."
            ),
        )
    mae = sum(errors) / len(errors)
    baseline_mae = sum(baseline_errors) / len(baseline_errors)
    mape = sum(pct_errors) / len(pct_errors) if pct_errors else None
    note = (
        f"Evaluated on {len(errors)} complete months using only prior months. "
        "Current partial month excluded. Small samples are sensitive to one-off expenses."
    )
    return Backtest(
        method=f"rolling_average_{window}m",
        mae=float(q(mae)),
        mape=float(q(mape)) if mape is not None else None,
        sample_size=len(errors),
        baseline_method="naive_last_month",
        baseline_mae=float(q(baseline_mae)),
        note=note,
    )


# ---------------------------------------------------------------------------
# Unusual spending detection
# ---------------------------------------------------------------------------
def detect_anomalies(
    transactions: Sequence[TxnLike],
    as_of: date | None = None,
    threshold: float = 3.5,
    lookback_days: int = 45,
    min_sample: int = 5,
) -> list[Anomaly]:
    """Robust modified z-score using rolling median and MAD.

    For each candidate expense in the lookback window, prior expenses in the
    same category (up to 180 days earlier) form the reference distribution.
    With fewer than ``min_sample`` observations nothing is flagged. A zero MAD
    falls back to a scale of max(₹1, 10% of median). Results are indicators,
    not fraud determinations.
    """
    as_of = as_of or date.today()
    cutoff = as_of - timedelta(days=lookback_days)
    expenses = [t for t in transactions if t.type == "expense" and t.occurred_on <= as_of]
    candidates = [t for t in expenses if t.occurred_on >= cutoff]
    results: list[Anomaly] = []
    for txn in sorted(candidates, key=lambda t: (t.occurred_on, t.id), reverse=True):
        history = [
            t.amount
            for t in expenses
            if t.category_id == txn.category_id
            and t.id != txn.id
            and t.occurred_on < txn.occurred_on
            and t.occurred_on >= txn.occurred_on - timedelta(days=180)
        ]
        if len(history) < min_sample:
            continue
        med = q(median(history))
        deviations = [abs(float(amount - med)) for amount in history]
        mad = q(median(deviations))
        if mad == 0:
            scale = max(Decimal("1.00"), q(med * Decimal("0.10")))
        else:
            scale = mad
        if scale <= 0:
            continue
        score = float(q(MAD_SCALE * (txn.amount - med) / scale))
        if score < threshold:
            continue
        explanation = (
            f"₹{txn.amount:,.2f} is {score:.1f} robust deviations above the category median of "
            f"₹{med:,.2f} from {len(history)} earlier transactions (MAD ₹{mad:,.2f}). "
            "This is an unusual-spending indicator, not evidence of fraud."
        )
        results.append(
            Anomaly(
                transaction_id=txn.id,
                merchant=txn.merchant,
                category_id=txn.category_id,
                amount=q(txn.amount),
                occurred_on=txn.occurred_on,
                median_amount=med,
                mad_amount=mad,
                score=score,
                threshold=threshold,
                sample_size=len(history),
                explanation=explanation,
            )
        )
    return results


# ---------------------------------------------------------------------------
# Recurring payments
# ---------------------------------------------------------------------------
def normalise_merchant(value: str) -> str:
    text = value.lower().strip()
    text = re.sub(r"^(upi|card|neft|imps)[/\-:\s]+", "", text)
    text = re.sub(r"[^a-z0-9 ]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or "unknown"


def _coefficient_of_variation(values: Sequence[float]) -> float:
    if not values:
        return 1.0
    mean = sum(values) / len(values)
    if mean == 0:
        return 1.0
    variance = sum((value - mean) ** 2 for value in values) / len(values)
    return math.sqrt(variance) / mean


def detect_recurring_payments(
    transactions: Sequence[TxnLike], as_of: date | None = None, min_occurrences: int = 3
) -> list[RecurringCandidate]:
    as_of = as_of or date.today()
    groups: dict[tuple[str, int], list[TxnLike]] = defaultdict(list)
    for txn in transactions:
        if txn.type != "expense" or txn.occurred_on > as_of:
            continue
        groups[(normalise_merchant(txn.merchant), txn.category_id)].append(txn)

    candidates: list[RecurringCandidate] = []
    for (merchant_key, category_id), txns in groups.items():
        txns = sorted(txns, key=lambda t: t.occurred_on)
        if len(txns) < min_occurrences:
            continue
        amounts = [float(t.amount) for t in txns]
        cv = _coefficient_of_variation(amounts)
        if cv > RECURRING_TOLERANCE:
            continue
        intervals = [(txns[i].occurred_on - txns[i - 1].occurred_on).days for i in range(1, len(txns))]
        valid_intervals = [days for days in intervals if 5 <= days <= 100]
        if len(valid_intervals) < min_occurrences - 1:
            # Sparse or very long gaps can still be irregular candidates when
            # amounts and category repeat, but confidence is lower.
            if cv > 0.15:
                continue
            median_interval = float(median(intervals)) if intervals else 0.0
            frequency = "irregular"
            interval_consistency = 0.3
        else:
            median_interval = float(median(valid_intervals))
            if 5 <= median_interval <= 9:
                frequency = "weekly"
            elif 12 <= median_interval <= 16:
                frequency = "fortnightly"
            elif 25 <= median_interval <= 35:
                frequency = "monthly"
            elif 80 <= median_interval <= 100:
                frequency = "quarterly"
            else:
                frequency = "irregular"
            tolerance = 2.5 if frequency in {"weekly", "fortnightly"} else 5
            matches = sum(1 for days in valid_intervals if abs(days - median_interval) <= tolerance)
            interval_consistency = matches / len(valid_intervals)
        amount_consistency = max(0.0, 1.0 - cv)
        occurrence_score = min(1.0, len(txns) / 6)
        confidence = round(
            max(0.0, min(1.0, 0.4 * amount_consistency + 0.35 * interval_consistency + 0.25 * occurrence_score)),
            2,
        )
        if confidence < 0.35:
            continue
        avg_amount = q(sum((t.amount for t in txns), ZERO) / Decimal(len(txns)))
        next_expected = None
        if frequency != "irregular" and median_interval:
            next_expected = txns[-1].occurred_on + timedelta(days=round(median_interval))
        explanation = (
            f"{len(txns)} expenses at {txns[-1].merchant} average ₹{avg_amount:,.2f} with "
            f"a {frequency.replace('_', ' ')} cadence (median {median_interval:.0f} days, "
            f"amount variation {cv * 100:.0f}%). Candidate only; confirm before treating it as recurring."
        )
        candidates.append(
            RecurringCandidate(
                merchant_key=merchant_key,
                merchant=txns[-1].merchant,
                category_id=category_id,
                average_amount=avg_amount,
                last_amount=q(txns[-1].amount),
                frequency=frequency,
                interval_days=round(median_interval, 1),
                occurrences=len(txns),
                last_seen=txns[-1].occurred_on,
                next_expected=next_expected,
                confidence=confidence,
                explanation=explanation,
            )
        )
    candidates.sort(key=lambda c: (-c.confidence, c.merchant_key))
    return candidates


# ---------------------------------------------------------------------------
# Scenario simulation
# ---------------------------------------------------------------------------
@dataclass
class ScenarioResult:
    baseline_expenses: Decimal
    adjusted_expenses: Decimal
    baseline_income: Decimal
    adjusted_income: Decimal
    monthly_impact: Decimal
    projected_savings: Decimal
    category_changes: list[dict] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)


def simulate_scenario(
    baseline_category_spend: dict[int, Decimal],
    category_names: dict[int, str],
    baseline_income: Decimal,
    category_reductions: dict[int, float],
    shopping_category_id: int | None,
    shopping_reduction_amount: Decimal,
    income_change: Decimal,
    additional_monthly_savings: Decimal,
    one_time_expense: Decimal,
    months: int,
) -> ScenarioResult:
    adjusted: dict[int, Decimal] = {key: q(value) for key, value in baseline_category_spend.items()}
    changes: list[dict] = []
    for category_id, percent in category_reductions.items():
        original = adjusted.get(category_id, ZERO)
        reduction = q(original * Decimal(str(percent)) / Decimal(100))
        adjusted[category_id] = q(max(ZERO, original - reduction))
        changes.append(
            {
                "category_id": category_id,
                "name": category_names.get(category_id, "Category"),
                "baseline": q(original),
                "adjusted": adjusted[category_id],
                "savings": reduction,
            }
        )
    if shopping_category_id is not None and shopping_reduction_amount > 0:
        original = adjusted.get(shopping_category_id, ZERO)
        actual_reduction = min(q(shopping_reduction_amount), original)
        adjusted[shopping_category_id] = q(original - actual_reduction)
        existing = next((c for c in changes if c["category_id"] == shopping_category_id), None)
        if existing:
            existing["adjusted"] = adjusted[shopping_category_id]
            existing["savings"] = q(existing["savings"] + actual_reduction)
        else:
            changes.append(
                {
                    "category_id": shopping_category_id,
                    "name": category_names.get(shopping_category_id, "Shopping"),
                    "baseline": q(original),
                    "adjusted": adjusted[shopping_category_id],
                    "savings": actual_reduction,
                }
            )
    baseline_expenses = q(sum(baseline_category_spend.values(), ZERO))
    adjusted_expenses = q(sum(adjusted.values(), ZERO))
    adjusted_income = q(max(ZERO, baseline_income + income_change))
    monthly_savings = q(adjusted_income - adjusted_expenses)
    additional = q(additional_monthly_savings)
    projected = q(monthly_savings * months - one_time_expense + additional * months)
    assumptions = [
        "Baseline spending is the average of the observed baseline months by category.",
        "Reductions apply to that baseline and cannot make a category negative.",
        "Income change is treated as a recurring monthly change; the one-time expense is not.",
        "Additional monthly savings is a transfer, so it adds to projected savings without changing cash-flow net.",
        "Projected savings are hypothetical and exclude investment returns, taxes, and emergencies.",
    ]
    return ScenarioResult(
        baseline_expenses=baseline_expenses,
        adjusted_expenses=adjusted_expenses,
        baseline_income=q(baseline_income),
        adjusted_income=adjusted_income,
        monthly_impact=monthly_savings,
        projected_savings=projected,
        category_changes=changes,
        assumptions=assumptions,
    )
