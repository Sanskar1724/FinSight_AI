export type TransactionType = "income" | "expense";
export type BudgetStatus = "healthy" | "approaching" | "critical" | "exceeded";
export type GoalStatus = "on_track" | "behind" | "achieved" | "at_risk" | "no_date";
export type Severity = "info" | "warning" | "critical";

export interface User {
  id: number;
  email: string;
  name: string;
  is_demo: boolean;
  timezone: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  kind: TransactionType;
  icon: string;
  color: string;
}

export interface Transaction {
  id: number;
  type: TransactionType;
  amount: number;
  occurred_on: string;
  merchant: string;
  notes: string | null;
  payment_method: string;
  category: Category;
  created_at: string;
}

export interface TransactionPage {
  items: Transaction[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface TransactionPayload {
  type: TransactionType;
  amount: string;
  occurred_on: string;
  category_id: number;
  merchant: string;
  notes?: string;
  payment_method: string;
}

export interface CSVRowPreview {
  row_number: number;
  valid: boolean;
  duplicate: boolean;
  errors: string[];
  data: Record<string, unknown>;
}

export interface CSVPreview {
  rows: CSVRowPreview[];
  valid_count: number;
  error_count: number;
  duplicate_count: number;
  headers: string[];
  detected_columns: Record<string, string | null>;
}

export interface CSVImportResult {
  imported: number;
  skipped_duplicates: number;
  failed: number;
  errors: string[];
}

export interface BudgetRisk {
  projected_spend: number;
  projected_utilization: number;
  risk_level: "on_track" | "watch" | "at_risk" | "likely_over" | "over";
  reliability: "low" | "medium" | "high";
  elapsed_days: number;
  total_days: number;
  remaining_days: number;
  daily_burn: number;
  history_months_used: number;
  explanation: string;
}

export interface Budget {
  id: number;
  category: Category;
  month: string;
  limit_amount: number;
  warning_threshold: number;
  critical_threshold: number;
  actual_spend: number;
  remaining: number;
  utilization: number;
  status: BudgetStatus;
  threshold_crossed: "warning" | "critical" | "exceeded" | null;
  projected_spend: number | null;
  risk: BudgetRisk | null;
  previous_month_spend: number | null;
  change_vs_previous: number | null;
}

export interface BudgetList {
  items: Budget[];
  total_limit: number;
  total_spend: number;
  overall_utilization: number;
  month: string;
}

export interface GoalContribution {
  id: number;
  amount: number;
  contributed_on: string;
  note: string | null;
}

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  saved_amount: number;
  remaining_amount: number;
  target_date: string | null;
  progress_percent: number;
  required_monthly: number | null;
  months_remaining: number | null;
  estimated_completion: string | null;
  average_monthly_contribution: number;
  status: GoalStatus;
  behind_by: number | null;
  explanation: string;
  contributions: GoalContribution[];
}

export interface GoalList {
  items: Goal[];
  total_target: number;
  total_saved: number;
  overall_progress: number;
}

export interface Insight {
  rule_id: string;
  severity: Severity;
  title: string;
  explanation: string;
  evidence: string[];
  metric: number | null;
  action_label: string | null;
  action_url: string | null;
}

export interface NotificationDelivery {
  channel: string;
  status: string;
  attempted_at: string;
  error: string | null;
}

export interface AppNotification {
  id: number;
  category: string;
  severity: Severity;
  title: string;
  message: string;
  amount: number | null;
  trigger_reason: string;
  action_label: string | null;
  action_url: string | null;
  event_key: string;
  is_read: boolean;
  dismissed_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  deliveries: NotificationDelivery[];
}

export interface NotificationList {
  items: AppNotification[];
  total: number;
  unread: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface NotificationPreferences {
  budget_warning_enabled: boolean;
  unusual_spending_enabled: boolean;
  recurring_enabled: boolean;
  bill_reminders_enabled: boolean;
  goal_enabled: boolean;
  weekly_summary_enabled: boolean;
  monthly_summary_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  warning_threshold: number;
  critical_threshold: number;
  email_enabled: boolean;
}

export interface Bill {
  id: number;
  name: string;
  amount: number;
  due_date: string;
  is_paid: boolean;
}

export interface TrendPoint {
  label: string;
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CategorySpend {
  category_id: number;
  name: string;
  color: string;
  amount: number;
  percent: number;
  transaction_count: number;
}

export interface RecentTransaction {
  id: number;
  type: TransactionType;
  amount: number;
  occurred_on: string;
  merchant: string;
  category_name: string;
  category_color: string;
  category_icon?: string | null;
  payment_method: string;
}

export interface CashFlowSummary {
  income: number;
  expenses: number;
  net_cash_flow: number;
  savings_rate: number | null;
  transaction_count: number;
  income_change: number | null;
  expense_change: number | null;
  comparison_label: string;
}

export interface ForecastPayload {
  next_month: string;
  label: string;
  predicted: number;
  lower: number;
  upper: number;
  method: string;
  months_used: string[];
  assumptions: string[];
  backtest: {
    mae: number | null;
    mape: number | null;
    sample_size: number;
    baseline_mae: number | null;
    note: string;
  };
}

export interface Dashboard {
  period: { start: string; end: string };
  comparison_period: { start: string; end: string };
  summary: CashFlowSummary;
  trend: TrendPoint[];
  category_breakdown: CategorySpend[];
  budgets: Budget[];
  goals: Goal[];
  recent_transactions: RecentTransaction[];
  insights: Insight[];
  notifications: AppNotification[];
  forecast: ForecastPayload | null;
  balance_note: string;
}

export interface MonthlyTrend {
  month: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
  savings_rate: number | null;
}

export interface CategoryComparison {
  category_id: number;
  name: string;
  color: string;
  current: number;
  previous: number;
  change: number | null;
  share: number;
}

export interface BudgetAdherence {
  category_id: number;
  category_name: string;
  limit_amount: number;
  actual_spend: number;
  utilization: number;
  status: string;
  on_track: boolean;
}

export interface RecurringCandidate {
  merchant_key: string;
  merchant: string;
  category_name: string;
  average_amount: number;
  last_amount: number;
  frequency: "weekly" | "fortnightly" | "monthly" | "quarterly" | "irregular";
  interval_days: number;
  occurrences: number;
  last_seen: string;
  next_expected: string | null;
  confidence: number;
  status: "candidate" | "confirmed" | "dismissed";
  explanation: string;
}

export interface Anomaly {
  transaction_id: number;
  merchant: string;
  category_name: string;
  amount: number;
  occurred_on: string;
  median_amount: number;
  mad_amount: number;
  score: number;
  threshold: number;
  sample_size: number;
  explanation: string;
  feedback: string | null;
}

export interface ForecastPoint {
  month: string;
  label: string;
  predicted: number;
  lower: number;
  upper: number;
}

export interface Backtest {
  method: string;
  mae: number | null;
  mape: number | null;
  sample_size: number;
  baseline_method: string;
  baseline_mae: number | null;
  note: string;
}

export interface Analytics {
  period: { start: string; end: string };
  monthly_trend: MonthlyTrend[];
  category_comparison: CategoryComparison[];
  category_breakdown: CategorySpend[];
  budget_adherence: BudgetAdherence[];
  recurring: RecurringCandidate[];
  anomalies: Anomaly[];
  forecast: ForecastPoint[];
  forecast_assumptions: string[];
  backtest: Backtest;
  generated_at: string;
}

export interface ScenarioRequest {
  category_reductions: { category_id: number; reduction_percent: number }[];
  shopping_reduction_amount: string;
  income_change: string;
  additional_monthly_savings: string;
  one_time_expense: string;
  months: number;
  goal_id?: number | null;
}

export interface ScenarioCategoryChange {
  category_id: number;
  name: string;
  baseline: number;
  adjusted: number;
  savings: number;
}

export interface ScenarioGoalProjection {
  goal_id: number;
  name: string;
  current_saved: number;
  projected_saved: number;
  progress_percent: number;
  target_date: string | null;
  note: string;
}

export interface ScenarioResult {
  baseline_monthly_income: number;
  baseline_monthly_expenses: number;
  adjusted_monthly_income: number;
  adjusted_monthly_expenses: number;
  baseline_net: number;
  adjusted_net: number;
  monthly_impact: number;
  one_time_expense: number;
  horizon_months: number;
  projected_savings: number;
  category_changes: ScenarioCategoryChange[];
  goal_projection: ScenarioGoalProjection | null;
  assumptions: string[];
  disclaimer: string;
}

export interface EvidenceItem {
  id: string;
  label: string;
  value: string;
  source: string;
  route: string | null;
}

export interface ChatSource {
  chunk_id: number;
  title: string;
  source: string;
  snippet: string;
  similarity: number;
}

export interface ChatResponse {
  session_id: number;
  message_id: number;
  answer: string;
  evidence: EvidenceItem[];
  sources: ChatSource[];
  provider: string;
  model: string;
  mode: string;
  provider_fallback: boolean;
  limitations: string[];
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  evidence_json: string | null;
  sources_json: string | null;
  model: string | null;
  mode: string | null;
  provider_fallback: boolean;
  created_at: string;
}

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  preview: string | null;
}

export interface ChatSessionDetail {
  id: number;
  title: string;
  messages: ChatMessage[];
}

export interface AIStatus {
  provider: string;
  model: string;
  configured: boolean;
  grounded_mode_available: boolean;
  fallback_available: boolean;
  note: string;
}

export interface ResearchCase {
  id: number;
  slug: string;
  category: string;
  question_template: string;
  focus: string;
}

export interface ResearchScore {
  correctness: number | null;
  relevance: number | null;
  grounding: number | null;
  unsupported: number | null;
  usefulness: number | null;
  total: number | null;
}

export interface ResearchResponse {
  id: number;
  case_id: number;
  mode: "baseline" | "grounded";
  question: string;
  response: string;
  evidence: EvidenceItem[];
  retrieval: ChatSource[];
  scores: ResearchScore;
  failure_notes: string | null;
}

export interface ResearchRun {
  id: number;
  status: "queued" | "running" | "completed" | "failed";
  provider: string;
  model_id: string;
  prompt_version: string;
  rubric_version: string;
  total_cases: number;
  notes: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  response_count: number;
  summary: {
    response_count: number;
    modes: Record<
      string,
      { count: number; averages: Record<string, number | null> | null }
    >;
    delta_grounded_minus_baseline: Record<string, number | null> | null;
    rubric_version: string;
    note: string;
  } | null;
}

export interface ResearchRunDetail extends ResearchRun {
  responses: ResearchResponse[];
  case_lookup: Record<string, ResearchCase>;
}
