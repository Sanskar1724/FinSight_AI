from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from app.services.finance import (
    TxnLike,
    backtest_rolling_average,
    budget_risk,
    budget_status,
    cash_flow,
    detect_anomalies,
    detect_recurring_payments,
    format_inr,
    goal_metrics,
    percentage_change,
    previous_period,
    rolling_average_forecast,
    simulate_scenario,
)


def txn(
    txn_id: int,
    amount: str,
    day: date,
    *,
    category: int = 1,
    txn_type: str = "expense",
    merchant: str = "Merchant",
) -> TxnLike:
    return TxnLike(
        id=txn_id,
        type=txn_type,
        amount=Decimal(amount),
        occurred_on=day,
        category_id=category,
        merchant=merchant,
    )


def test_cash_flow_and_savings_rate_are_deterministic() -> None:
    rows = [
        txn(1, "50000.00", date(2026, 10, 1), txn_type="income"),
        txn(2, "12000.25", date(2026, 10, 2)),
        txn(3, "799.75", date(2026, 10, 3)),
    ]
    flow = cash_flow(rows)
    assert flow.income == Decimal("50000.00")
    assert flow.expenses == Decimal("12800.00")
    assert flow.net == Decimal("37200.00")
    assert flow.savings_rate == 74.4
    assert flow.transaction_count == 3


def test_percentage_change_is_not_comparable_for_zero_baseline() -> None:
    assert percentage_change(Decimal("100"), Decimal("80")) == 25.0
    assert percentage_change(Decimal("100"), Decimal("0")) is None
    assert percentage_change(Decimal("100"), None) is None


def test_previous_period_has_equal_length() -> None:
    start, end = previous_period(date(2026, 10, 1), date(2026, 10, 23))
    assert end == date(2026, 9, 30)
    assert (end - start).days == 22


def test_inr_uses_indian_grouping() -> None:
    assert format_inr(Decimal("125000")) == "\u20b91,25,000.00"
    assert format_inr(Decimal("-12345678.5")) == "-\u20b91,23,45,678.50"


def test_budget_status_boundaries() -> None:
    assert budget_status(69.99, 70, 90) == ("healthy", None)
    assert budget_status(70, 70, 90) == ("approaching", "warning")
    assert budget_status(90, 70, 90) == ("critical", "critical")
    assert budget_status(100.01, 70, 90) == ("exceeded", "exceeded")


def test_budget_risk_projects_current_burn_and_flags_overrun() -> None:
    result = budget_risk(
        spent=Decimal("5000"),
        limit_amount=Decimal("8000"),
        month=date(2026, 2, 1),
        today=date(2026, 2, 14),
        historical_monthly_spend=[Decimal("7000"), Decimal("7200")],
    )
    assert result.total_days == 28
    assert result.elapsed_days == 14
    assert result.projected_spend > Decimal("8000")
    assert result.risk_level in {"at_risk", "likely_over"}
    assert result.reliability == "high"


def test_completed_month_budget_projection_equals_actual() -> None:
    result = budget_risk(
        spent=Decimal("2500"),
        limit_amount=Decimal("2000"),
        month=date(2026, 1, 1),
        today=date(2026, 2, 5),
    )
    assert result.projected_spend == Decimal("2500.00")
    assert result.risk_level == "over"
    assert result.remaining_days == 0


def test_goal_metrics_marks_achieved() -> None:
    metrics = goal_metrics(
        target_amount=Decimal("50000"),
        contributions=[
            (date(2026, 1, 5), Decimal("20000")),
            (date(2026, 2, 5), Decimal("30000")),
        ],
        today=date(2026, 2, 10),
        target_date=date(2026, 8, 1),
    )
    assert metrics.saved == Decimal("50000.00")
    assert metrics.remaining == Decimal("0.00")
    assert metrics.progress_percent == 100.0
    assert metrics.status == "achieved"


def test_goal_metrics_requires_date_for_schedule() -> None:
    metrics = goal_metrics(
        target_amount=Decimal("100000"),
        contributions=[(date(2026, 1, 1), Decimal("10000"))],
        today=date(2026, 2, 1),
        target_date=None,
    )
    assert metrics.required_monthly is None
    assert metrics.status == "no_date"


def test_anomaly_detection_uses_prior_same_category_data() -> None:
    start = date(2026, 8, 1)
    rows = [
        txn(index, "500.00", start + timedelta(days=index), category=7)
        for index in range(6)
    ]
    rows.append(txn(99, "5000.00", start + timedelta(days=10), category=7))
    anomalies = detect_anomalies(rows, as_of=date(2026, 9, 10))
    assert [item.transaction_id for item in anomalies] == [99]
    assert anomalies[0].median_amount == Decimal("500.00")
    assert anomalies[0].score > 3.5


def test_anomaly_detection_does_not_flag_normal_spending() -> None:
    start = date(2026, 8, 1)
    rows = [
        txn(index, "500.00", start + timedelta(days=index), category=7)
        for index in range(8)
    ]
    assert detect_anomalies(rows, as_of=date(2026, 9, 10)) == []


def test_recurring_detection_finds_monthly_subscription() -> None:
    rows = [
        txn(1, "649.00", date(2026, 6, 5), category=3, merchant="Netflix"),
        txn(2, "649.00", date(2026, 7, 5), category=3, merchant="Netflix"),
        txn(3, "649.00", date(2026, 8, 5), category=3, merchant="Netflix"),
        txn(4, "649.00", date(2026, 9, 5), category=3, merchant="Netflix"),
    ]
    candidates = detect_recurring_payments(rows, as_of=date(2026, 10, 1))
    assert len(candidates) == 1
    assert candidates[0].merchant_key == "netflix"
    assert candidates[0].frequency == "monthly"
    assert candidates[0].occurrences == 4


def test_forecast_excludes_current_partial_month() -> None:
    rows = [
        txn(1, "3000.00", date(2026, 6, 10)),
        txn(2, "4000.00", date(2026, 7, 10)),
        txn(3, "5000.00", date(2026, 8, 10)),
        txn(4, "99999.00", date(2026, 9, 2)),
    ]
    forecast = rolling_average_forecast(rows, as_of=date(2026, 9, 15))
    assert forecast.predicted == Decimal("4000.00")
    assert forecast.months_used == ["2026-06", "2026-07", "2026-08"]
    assert forecast.lower <= forecast.predicted <= forecast.upper


def test_backtest_has_no_future_leakage_and_reports_sample() -> None:
    rows = [
        txn(index, str(1000 + index * 100), date(2026, month, 10))
        for index, month in enumerate(range(1, 9), start=1)
    ]
    result = backtest_rolling_average(rows, as_of=date(2026, 9, 1))
    assert result.sample_size == 5
    assert result.method == "rolling_average_3m"
    assert result.mae is not None


def test_scenario_reductions_cannot_make_category_negative() -> None:
    result = simulate_scenario(
        baseline_category_spend={1: Decimal("1000"), 2: Decimal("500")},
        category_names={1: "Food", 2: "Shopping"},
        baseline_income=Decimal("10000"),
        category_reductions={1: 25.0},
        shopping_category_id=2,
        shopping_reduction_amount=Decimal("900"),
        income_change=Decimal("0"),
        additional_monthly_savings=Decimal("0"),
        one_time_expense=Decimal("0"),
        months=2,
    )
    assert result.adjusted_expenses == Decimal("750.00")
    assert result.monthly_impact == Decimal("9250.00")
    assert result.projected_savings == Decimal("18500.00")
    shopping = next(item for item in result.category_changes if item["category_id"] == 2)
    assert shopping["adjusted"] == Decimal("0.00")
    assert shopping["savings"] == Decimal("500.00")
