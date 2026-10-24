from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator

Money = Annotated[
    Decimal,
    PlainSerializer(lambda value: float(value), return_type=float, when_used="json"),
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8, max_length=128)
    accept_terms: bool

    @field_validator("accept_terms")
    @classmethod
    def terms_must_be_accepted(cls, value: bool) -> bool:
        if not value:
            raise ValueError("You must accept the Terms of Service and Privacy Policy")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORMModel):
    id: int
    email: str
    name: str
    is_demo: bool
    timezone: str
    created_at: datetime


class AuthResponse(BaseModel):
    user: UserOut


class SessionResponse(BaseModel):
    """Current session; ``user`` is null when nobody is signed in."""

    user: UserOut | None = None


# ---------- Categories ----------
class CategoryOut(ORMModel):
    id: int
    name: str
    slug: str
    kind: str
    icon: str
    color: str


# ---------- Transactions ----------
TransactionType = Literal["income", "expense"]


class TransactionCreate(BaseModel):
    type: TransactionType
    amount: Decimal = Field(gt=0, le=Decimal("999999999999.99"), decimal_places=2)
    occurred_on: date
    category_id: int
    merchant: str = Field(min_length=1, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
    payment_method: str = Field(default="UPI", max_length=40)


class TransactionUpdate(BaseModel):
    type: TransactionType | None = None
    amount: Decimal | None = Field(default=None, gt=0, le=Decimal("999999999999.99"))
    occurred_on: date | None = None
    category_id: int | None = None
    merchant: str | None = Field(default=None, min_length=1, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
    payment_method: str | None = Field(default=None, max_length=40)

    @field_validator("amount")
    @classmethod
    def quantize_amount(cls, value: Decimal | None) -> Decimal | None:
        if value is None:
            return None
        return value.quantize(Decimal("0.01"))


class TransactionOut(ORMModel):
    id: int
    type: str
    amount: Money
    occurred_on: date
    merchant: str
    notes: str | None
    payment_method: str
    category: CategoryOut
    created_at: datetime


class TransactionPage(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
    pages: int


class TransactionSuggestion(BaseModel):
    """Category and payment method last used for a merchant, if known."""

    merchant: str | None = None
    type: Literal["income", "expense"] | None = None
    category_id: int | None = None
    payment_method: str | None = None


class CSVRowPreview(BaseModel):
    row_number: int
    valid: bool
    duplicate: bool
    errors: list[str] = []
    data: dict[str, Any] = {}


class CSVPreviewResponse(BaseModel):
    rows: list[CSVRowPreview]
    valid_count: int
    error_count: int
    duplicate_count: int
    headers: list[str]
    detected_columns: dict[str, str | None]


class CSVImportResponse(BaseModel):
    imported: int
    skipped_duplicates: int
    failed: int
    errors: list[str]


# ---------- Budgets ----------
class BudgetCreate(BaseModel):
    category_id: int
    month: date
    limit_amount: Decimal = Field(gt=0, le=Decimal("999999999999.99"))
    warning_threshold: int | None = Field(default=None, ge=1, le=99)
    critical_threshold: int | None = Field(default=None, ge=2, le=100)

    @field_validator("month")
    @classmethod
    def first_of_month(cls, value: date) -> date:
        return value.replace(day=1)

    @field_validator("critical_threshold")
    @classmethod
    def thresholds_ordered(cls, value: int | None, info: Any) -> int | None:
        warning = info.data.get("warning_threshold")
        if value is not None and warning is not None and value <= warning:
            raise ValueError("critical_threshold must be greater than warning_threshold")
        return value


class BudgetUpdate(BaseModel):
    limit_amount: Decimal | None = Field(default=None, gt=0, le=Decimal("999999999999.99"))
    warning_threshold: int | None = Field(default=None, ge=1, le=99)
    critical_threshold: int | None = Field(default=None, ge=2, le=100)


class BudgetRisk(BaseModel):
    projected_spend: Money
    projected_utilization: float
    risk_level: Literal["on_track", "watch", "at_risk", "likely_over", "over"]
    reliability: Literal["low", "medium", "high"]
    elapsed_days: int
    total_days: int
    remaining_days: int
    daily_burn: Money
    history_months_used: int
    explanation: str


class BudgetOut(BaseModel):
    id: int
    category: CategoryOut
    month: date
    limit_amount: Money
    warning_threshold: int
    critical_threshold: int
    actual_spend: Money
    remaining: Money
    utilization: float
    status: Literal["healthy", "approaching", "critical", "exceeded"]
    threshold_crossed: Literal["warning", "critical", "exceeded"] | None
    projected_spend: Money | None
    risk: BudgetRisk | None
    previous_month_spend: Money | None
    change_vs_previous: float | None


class BudgetListResponse(BaseModel):
    items: list[BudgetOut]
    total_limit: Money
    total_spend: Money
    overall_utilization: float
    month: date


# ---------- Goals ----------
class GoalCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    target_amount: Decimal = Field(gt=0, le=Decimal("999999999999.99"))
    target_date: date | None = None


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    target_amount: Decimal | None = Field(default=None, gt=0, le=Decimal("999999999999.99"))
    target_date: date | None = None


class ContributionCreate(BaseModel):
    amount: Decimal = Field(gt=0, le=Decimal("999999999999.99"))
    contributed_on: date
    note: str | None = Field(default=None, max_length=255)


class ContributionOut(ORMModel):
    id: int
    amount: Money
    contributed_on: date
    note: str | None


class GoalOut(BaseModel):
    id: int
    name: str
    target_amount: Money
    saved_amount: Money
    remaining_amount: Money
    target_date: date | None
    progress_percent: float
    required_monthly: Money | None
    months_remaining: int | None
    estimated_completion: date | None
    average_monthly_contribution: Money
    status: Literal["on_track", "behind", "achieved", "at_risk", "no_date"]
    behind_by: Money | None
    explanation: str
    contributions: list[ContributionOut] = []


class GoalListResponse(BaseModel):
    items: list[GoalOut]
    total_target: Money
    total_saved: Money
    overall_progress: float


# ---------- Dashboard ----------
class CashFlowSummary(BaseModel):
    income: Money
    expenses: Money
    net_cash_flow: Money
    savings_rate: float | None
    transaction_count: int
    income_change: float | None
    expense_change: float | None
    comparison_label: str


class TrendPoint(BaseModel):
    label: str
    period: str
    income: Money
    expenses: Money
    net: Money


class CategorySpend(BaseModel):
    category_id: int
    name: str
    color: str
    amount: Money
    percent: float
    transaction_count: int


class RecentTransaction(BaseModel):
    id: int
    type: str
    amount: Money
    occurred_on: date
    merchant: str
    category_name: str
    category_color: str
    category_icon: str | None = None
    payment_method: str


class InsightOut(BaseModel):
    rule_id: str
    severity: Literal["info", "warning", "critical"]
    title: str
    explanation: str
    evidence: list[str]
    metric: Money | None = None
    action_label: str | None = None
    action_url: str | None = None


class NotificationDeliveryOut(ORMModel):
    channel: str
    status: str
    attempted_at: datetime
    error: str | None


class NotificationOut(ORMModel):
    id: int
    category: str
    severity: str
    title: str
    message: str
    amount: Money | None
    trigger_reason: str
    action_label: str | None
    action_url: str | None
    event_key: str
    is_read: bool
    dismissed_at: datetime | None
    scheduled_for: datetime | None
    created_at: datetime
    deliveries: list[NotificationDeliveryOut] = []


class UnreadCount(BaseModel):
    unread: int


class DashboardResponse(BaseModel):
    period: dict[str, str]
    comparison_period: dict[str, str]
    summary: CashFlowSummary
    trend: list[TrendPoint]
    category_breakdown: list[CategorySpend]
    budgets: list[BudgetOut]
    goals: list[GoalOut]
    recent_transactions: list[RecentTransaction]
    insights: list[InsightOut]
    notifications: list[NotificationOut]
    forecast: dict[str, Any] | None
    balance_note: str


# ---------- Analytics ----------
class MonthlyTrend(BaseModel):
    month: str
    label: str
    income: Money
    expenses: Money
    net: Money
    savings_rate: float | None


class CategoryComparison(BaseModel):
    category_id: int
    name: str
    color: str
    current: Money
    previous: Money
    change: float | None
    share: float


class ForecastPoint(BaseModel):
    month: str
    label: str
    predicted: Money
    lower: Money
    upper: Money


class BacktestResult(BaseModel):
    method: str
    mae: float | None
    mape: float | None
    sample_size: int
    baseline_method: str
    baseline_mae: float | None
    note: str


class RecurringCandidate(BaseModel):
    merchant_key: str
    merchant: str
    category_name: str
    average_amount: Money
    last_amount: Money
    frequency: Literal["weekly", "fortnightly", "monthly", "quarterly", "irregular"]
    interval_days: float
    occurrences: int
    last_seen: date
    next_expected: date | None
    confidence: float
    status: Literal["candidate", "confirmed", "dismissed"]
    explanation: str


class AnomalyOut(BaseModel):
    transaction_id: int
    merchant: str
    category_name: str
    amount: Money
    occurred_on: date
    median_amount: Money
    mad_amount: Money
    score: float
    threshold: float
    sample_size: int
    explanation: str
    feedback: str | None


class BudgetAdherence(BaseModel):
    category_id: int
    category_name: str
    limit_amount: Money
    actual_spend: Money
    utilization: float
    status: str
    on_track: bool


class AnalyticsResponse(BaseModel):
    period: dict[str, str]
    monthly_trend: list[MonthlyTrend]
    category_comparison: list[CategoryComparison]
    category_breakdown: list[CategorySpend]
    budget_adherence: list[BudgetAdherence]
    recurring: list[RecurringCandidate]
    anomalies: list[AnomalyOut]
    forecast: list[ForecastPoint]
    forecast_assumptions: list[str]
    backtest: BacktestResult
    generated_at: datetime


# ---------- Scenarios ----------
class CategoryReduction(BaseModel):
    category_id: int
    reduction_percent: float = Field(gt=0, le=100)


class ScenarioRequest(BaseModel):
    category_reductions: list[CategoryReduction] = []
    shopping_reduction_amount: Decimal = Field(default=Decimal("0"), ge=0)
    income_change: Decimal = Field(default=Decimal("0"))
    additional_monthly_savings: Decimal = Field(default=Decimal("0"), ge=0)
    one_time_expense: Decimal = Field(default=Decimal("0"), ge=0)
    months: int = Field(default=6, ge=1, le=36)
    goal_id: int | None = None


class ScenarioCategoryChange(BaseModel):
    category_id: int
    name: str
    baseline: Money
    adjusted: Money
    savings: Money


class ScenarioGoalProjection(BaseModel):
    goal_id: int
    name: str
    current_saved: Money
    projected_saved: Money
    progress_percent: float
    target_date: date | None
    note: str


class ScenarioResponse(BaseModel):
    baseline_monthly_income: Money
    baseline_monthly_expenses: Money
    adjusted_monthly_income: Money
    adjusted_monthly_expenses: Money
    baseline_net: Money
    adjusted_net: Money
    monthly_impact: Money
    one_time_expense: Money
    horizon_months: int
    projected_savings: Money
    category_changes: list[ScenarioCategoryChange]
    goal_projection: ScenarioGoalProjection | None
    assumptions: list[str]
    disclaimer: str


# ---------- Notifications ----------
class NotificationListResponse(BaseModel):
    items: list[NotificationOut]
    total: int
    unread: int
    page: int
    page_size: int


class PreferencesOut(ORMModel):
    budget_warning_enabled: bool
    unusual_spending_enabled: bool
    recurring_enabled: bool
    bill_reminders_enabled: bool
    goal_enabled: bool
    weekly_summary_enabled: bool
    monthly_summary_enabled: bool
    quiet_hours_enabled: bool
    quiet_start: str
    quiet_end: str
    warning_threshold: int
    critical_threshold: int
    email_enabled: bool


class PreferencesUpdate(BaseModel):
    budget_warning_enabled: bool | None = None
    unusual_spending_enabled: bool | None = None
    recurring_enabled: bool | None = None
    bill_reminders_enabled: bool | None = None
    goal_enabled: bool | None = None
    weekly_summary_enabled: bool | None = None
    monthly_summary_enabled: bool | None = None
    quiet_hours_enabled: bool | None = None
    quiet_start: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    quiet_end: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    warning_threshold: int | None = Field(default=None, ge=1, le=99)
    critical_threshold: int | None = Field(default=None, ge=2, le=100)
    email_enabled: bool | None = None


class NotificationGenerateResponse(BaseModel):
    created: int
    skipped: int
    messages: list[str]


class BillCreate(BaseModel):
    name: str = Field(min_length=2, max_length=140)
    amount: Decimal = Field(gt=0, le=Decimal("999999999999.99"))
    due_date: date
    is_paid: bool = False


class BillUpdate(BaseModel):
    name: str | None = None
    amount: Decimal | None = Field(default=None, gt=0)
    due_date: date | None = None
    is_paid: bool | None = None


class BillOut(ORMModel):
    id: int
    name: str
    amount: Money
    due_date: date
    is_paid: bool


class AnomalyFeedbackRequest(BaseModel):
    status: Literal["dismissed", "confirmed"]
    note: str | None = Field(default=None, max_length=255)


class RecurringFeedbackRequest(BaseModel):
    status: Literal["confirmed", "dismissed"]


# ---------- AI ----------
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: int | None = None


class EvidenceItem(BaseModel):
    id: str
    label: str
    value: str
    source: str
    route: str | None = None


class ChatSource(BaseModel):
    chunk_id: int
    title: str
    source: str
    snippet: str
    similarity: float


class ChatMessageOut(ORMModel):
    id: int
    role: str
    content: str
    evidence_json: str | None
    sources_json: str | None
    model: str | None
    mode: str | None
    provider_fallback: bool
    created_at: datetime


class ChatResponse(BaseModel):
    session_id: int
    message_id: int
    answer: str
    evidence: list[EvidenceItem]
    sources: list[ChatSource]
    provider: str
    model: str
    mode: str
    provider_fallback: bool
    limitations: list[str]


class SessionOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    preview: str | None = None


class SessionDetail(BaseModel):
    id: int
    title: str
    messages: list[ChatMessageOut]


class AIStatus(BaseModel):
    provider: str
    model: str
    configured: bool
    grounded_mode_available: bool
    fallback_available: bool
    note: str


# ---------- Research ----------
class ResearchCaseOut(ORMModel):
    id: int
    slug: str
    category: str
    question_template: str
    focus: str


class ResearchScoreOut(BaseModel):
    correctness: float | None
    relevance: float | None
    grounding: float | None
    unsupported: float | None
    usefulness: float | None
    total: float | None


class ResearchResponseOut(BaseModel):
    id: int
    case_id: int
    mode: str
    question: str
    response: str
    evidence: list[dict[str, Any]]
    retrieval: list[dict[str, Any]]
    scores: ResearchScoreOut
    failure_notes: str | None


class ResearchRunRequest(BaseModel):
    case_ids: list[int] | None = None
    limit: int | None = Field(default=None, ge=1, le=60)


class ResearchRunOut(BaseModel):
    id: int
    status: str
    provider: str
    model_id: str
    prompt_version: str
    rubric_version: str
    total_cases: int
    notes: str | None
    error: str | None
    started_at: datetime
    finished_at: datetime | None
    response_count: int
    summary: dict[str, Any] | None = None


class ResearchRunDetail(ResearchRunOut):
    responses: list[ResearchResponseOut]
    case_lookup: dict[str, ResearchCaseOut]


class ResearchExport(BaseModel):
    run: ResearchRunOut
    responses: list[ResearchResponseOut]


# ---------- Misc ----------
class MessageResponse(BaseModel):
    message: str


class PublicConfig(BaseModel):
    support_email: str | None
    demo_enabled: bool


class HealthResponse(BaseModel):
    status: str
    database: str
    ai_provider: str
    ai_configured: bool
    version: str
