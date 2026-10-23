import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeAlert,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Lightbulb,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CategoryIcon } from "@/components/category-icon";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { MetricCard } from "@/components/metric-card";
import { BudgetStatusBadge } from "@/components/status-badge";
import { TransactionDialog } from "@/components/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError } from "@/lib/api";
import type { Dashboard } from "@/lib/types";
import {
  appHref,
  cn,
  formatDate,
  formatINR,
  formatRelative,
  percentage,
} from "@/lib/utils";

const severityStyles = {
  info: { icon: Lightbulb, className: "border-sky-200 bg-sky-50 text-sky-700" },
  warning: { icon: BadgeAlert, className: "border-amber-200 bg-amber-50 text-amber-700" },
  critical: { icon: BadgeAlert, className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const riskLabels = {
  on_track: "On track",
  watch: "Watch",
  at_risk: "At risk",
  likely_over: "Likely over",
  over: "Over budget",
};

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[132px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[360px] rounded-2xl lg:col-span-8" />
        <Skeleton className="h-[360px] rounded-2xl lg:col-span-4" />
        <Skeleton className="h-[300px] rounded-2xl lg:col-span-4" />
        <Skeleton className="h-[300px] rounded-2xl lg:col-span-4" />
        <Skeleton className="h-[300px] rounded-2xl lg:col-span-4" />
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<Dashboard>("/dashboard"),
  });

  const data = dashboardQuery.data;
  const firstName = user?.name.split(" ")[0] ?? "there";
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  const topBudgets = useMemo(
    () =>
      [...(data?.budgets ?? [])]
        .sort((a, b) => b.utilization - a.utilization)
        .slice(0, 4),
    [data?.budgets],
  );

  const totalCategory = useMemo(
    () => (data?.category_breakdown ?? []).reduce((sum, item) => sum + item.amount, 0),
    [data?.category_breakdown],
  );

  if (dashboardQuery.isLoading) return <OverviewSkeleton />;

  if (dashboardQuery.isError) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <RefreshCw className="size-5" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">The dashboard could not load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {dashboardQuery.error instanceof ApiError
            ? dashboardQuery.error.message
            : "Check your connection and try again."}
        </p>
        <Button className="mt-5" onClick={() => dashboardQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const isNew = data.summary.transaction_count === 0;
  const savingsRate = data.summary.savings_rate;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your money at a glance"
        title={`${greeting}, ${firstName}.`}
        description={
          isNew
            ? "Add your first transaction to turn this workspace into a clear picture of your money."
            : `${formatDate(data.period.start, "d MMM")} – ${formatDate(data.period.end, "d MMM yyyy")} · ${data.summary.transaction_count} recorded transactions.`
        }
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/analytics">
                Full analytics
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Add transaction
            </Button>
          </>
        }
      />

      {isNew && (
        <Card className="border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-teal-50/40 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Your ledger is ready for its first entry</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Add income and spending manually, or import a CSV. FinSight builds every insight
                from the records you choose to enter.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setDialogOpen(true)}>Add transaction</Button>
              <Button variant="outline" asChild>
                <Link to="/app/transactions?import=1">Import CSV</Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Income"
          value={formatINR(data.summary.income)}
          icon={ArrowDownLeft}
          hint={data.summary.comparison_label}
          change={data.summary.income_change}
          accent="emerald"
        />
        <MetricCard
          label="Expenses"
          value={formatINR(data.summary.expenses)}
          icon={ArrowUpRight}
          hint={data.summary.comparison_label}
          change={data.summary.expense_change}
          inverseChange
          accent="amber"
        />
        <MetricCard
          label="Net cash flow"
          value={formatINR(data.summary.net_cash_flow)}
          icon={Wallet}
          hint="Income minus expenses"
          accent={data.summary.net_cash_flow >= 0 ? "sky" : "amber"}
        />
        <MetricCard
          label="Savings rate"
          value={savingsRate === null ? "—" : percentage(savingsRate)}
          icon={CircleDollarSign}
          hint={savingsRate === null ? "No income recorded" : "Share of income kept"}
          accent="violet"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Cash flow</CardTitle>
              <CardDescription>Income and spending across the selected period</CardDescription>
            </div>
            <div className="hidden items-center gap-4 text-[10px] font-medium text-muted-foreground sm:flex">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" /> Income
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-400" /> Expenses
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.16} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e8efec" strokeDasharray="4 4" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={4}
                    width={52}
                    tickFormatter={(value) => formatINR(Number(value), true)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#059669"
                    strokeWidth={2}
                    fill="url(#income-fill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#expense-fill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 border-t border-border/60 pt-3 text-[10px] leading-relaxed text-muted-foreground">
              {data.balance_note}
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Budget pulse</CardTitle>
              <CardDescription>Where this month stands</CardDescription>
            </div>
            <Link
              to="/app/budgets"
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {topBudgets.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="No budgets yet"
                description="Set a monthly limit to see how spending is pacing."
                action={{ label: "Create a budget", onClick: () => window.location.assign("/app/budgets") }}
                className="py-6"
              />
            ) : (
              <div className="space-y-4">
                {topBudgets.map((budget) => (
                  <div key={budget.id}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: budget.category.color }}
                        />
                        <p className="truncate text-xs font-semibold">{budget.category.name}</p>
                      </div>
                      <BudgetStatusBadge status={budget.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="tabular">
                        {formatINR(budget.actual_spend)} of {formatINR(budget.limit_amount)}
                      </span>
                      <span className="font-semibold tabular">{percentage(budget.utilization)}</span>
                    </div>
                    <Progress
                      value={Math.min(100, budget.utilization)}
                      className="mt-1.5 h-1.5"
                      indicatorClassName={cn(
                        budget.status === "exceeded" || budget.status === "critical"
                          ? "bg-rose-500"
                          : budget.status === "approaching"
                            ? "bg-amber-400"
                            : "bg-emerald-500",
                      )}
                    />
                    {budget.risk && (
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        Projected {formatINR(budget.risk.projected_spend)} ·{" "}
                        <span
                          className={cn(
                            "font-semibold",
                            budget.risk.risk_level === "on_track"
                              ? "text-emerald-700"
                              : "text-amber-700",
                          )}
                        >
                          {riskLabels[budget.risk.risk_level]}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Worth noticing</CardTitle>
              <CardDescription>Rules-based observations</CardDescription>
            </div>
            <Lightbulb className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {data.insights.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                title="Everything looks steady"
                description="Insights appear when a budget, goal, or spending pattern needs attention."
                className="py-6"
              />
            ) : (
              <div className="space-y-3">
                {data.insights.slice(0, 3).map((insight) => {
                  const style = severityStyles[insight.severity];
                  const Icon = style.icon;
                  return (
                    <div
                      key={insight.rule_id}
                      className="rounded-xl border border-border/70 bg-background/50 p-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg border",
                            style.className,
                          )}
                        >
                          <Icon className="size-3" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold leading-snug">{insight.title}</p>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            {insight.explanation}
                          </p>
                          {insight.action_label && (
                            <Link
                              to={appHref(insight.action_url)}
                              className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline"
                            >
                              {insight.action_label}
                              <ChevronRight className="size-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Where it went</CardTitle>
            <CardDescription>Spending by category</CardDescription>
          </CardHeader>
          <CardContent>
            {data.category_breakdown.length === 0 ? (
              <EmptyState
                icon={TrendingDown}
                title="No spending yet"
                description="Add an expense to see your category mix."
                className="py-6"
              />
            ) : (
              <>
                <div className="relative mx-auto h-[172px] max-w-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.category_breakdown}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={78}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {data.category_breakdown.map((entry) => (
                          <Cell key={entry.category_id} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center">
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-muted-foreground">Total spent</p>
                      <p className="text-sm font-bold tabular">{formatINR(totalCategory, true)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {data.category_breakdown.slice(0, 4).map((item) => (
                    <div key={item.category_id} className="flex items-center gap-2 text-[11px]">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="flex-1 truncate text-muted-foreground">{item.name}</span>
                      <span className="font-semibold tabular">{formatINR(item.amount)}</span>
                      <span className="w-8 text-right text-[10px] text-muted-foreground">
                        {percentage(item.percent)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Goals</CardTitle>
              <CardDescription>Progress toward what matters</CardDescription>
            </div>
            <Link to="/app/goals" className="text-[11px] font-semibold text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {data.goals.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No goals yet"
                description="Turn a plan into a target with a date and a monthly pace."
                action={{ label: "Create a goal", onClick: () => window.location.assign("/app/goals") }}
                className="py-6"
              />
            ) : (
              <div className="space-y-4">
                {data.goals.slice(0, 3).map((goal) => (
                  <div key={goal.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold">{goal.name}</p>
                      <span className="text-[10px] font-bold tabular text-primary">
                        {percentage(goal.progress_percent)}
                      </span>
                    </div>
                    <Progress value={goal.progress_percent} className="mt-2 h-1.5" />
                    <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatINR(goal.saved_amount)} saved</span>
                      <span>{formatINR(goal.target_amount)} target</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Your latest recorded transactions</CardDescription>
            </div>
            <Link
              to="/app/transactions"
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              All transactions
            </Link>
          </CardHeader>
          <CardContent>
            {data.recent_transactions.length === 0 ? (
              <EmptyState
                icon={ArrowUpRight}
                title="No transactions yet"
                description="Your recent activity will appear here."
                action={{ label: "Add your first", onClick: () => setDialogOpen(true) }}
                className="py-8"
              />
            ) : (
              <div className="divide-y divide-border/60">
                {data.recent_transactions.map((txn) => (
                  <div key={txn.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <CategoryIcon
                      icon={txn.category_icon ?? undefined}
                      color={txn.category_color}
                      className="size-8 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{txn.merchant}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>{txn.category_name}</span>
                        <span className="size-0.5 rounded-full bg-muted-foreground/50" />
                        <span>{formatDate(txn.occurred_on, "d MMM")}</span>
                        <span className="hidden size-0.5 rounded-full bg-muted-foreground/50 sm:block" />
                        <span className="hidden sm:block">{txn.payment_method}</span>
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-xs font-semibold tabular",
                        txn.type === "income" ? "text-emerald-700" : "text-foreground",
                      )}
                    >
                      {txn.type === "income" ? "+" : "−"}
                      {formatINR(txn.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Next-month outlook</CardTitle>
              <CardDescription>Rolling-average forecast</CardDescription>
            </div>
            <CalendarClock className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            {data.forecast ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {data.forecast.label}
                </p>
                <p className="mt-1.5 text-2xl font-semibold tracking-[-0.03em] tabular">
                  {formatINR(data.forecast.predicted)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Range {formatINR(data.forecast.lower)} – {formatINR(data.forecast.upper)}
                </p>
                <div className="my-4 h-px bg-border/70" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Backtest MAE</p>
                    <p className="mt-1 text-xs font-semibold tabular">
                      {data.forecast.backtest.mae === null
                        ? "Not enough history"
                        : formatINR(data.forecast.backtest.mae)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Sample</p>
                    <p className="mt-1 text-xs font-semibold">
                      {data.forecast.backtest.sample_size} month
                      {data.forecast.backtest.sample_size === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 rounded-lg bg-secondary/60 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                  A range, not a guarantee. {data.forecast.assumptions[0]}
                </p>
                <Link
                  to="/app/analytics"
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  Explore the method
                  <ArrowRight className="size-3" />
                </Link>
              </>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="Not enough history"
                description="A forecast appears after at least one complete month of spending."
                className="py-6"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {data.notifications.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Latest updates</CardTitle>
              <CardDescription>Automated observations from your workspace</CardDescription>
            </div>
            <Link
              to="/app/notifications"
              className="text-[11px] font-semibold text-primary hover:underline"
            >
              Notification center
            </Link>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {data.notifications.map((notification) => (
              <Link
                key={notification.id}
                to={appHref(notification.action_url)}
                className="rounded-xl border border-border/70 bg-background/40 p-3 transition-colors hover:border-primary/25 hover:bg-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold">{notification.title}</p>
                  {!notification.is_read && (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                  {notification.message}
                </p>
                <p className="mt-1.5 text-[9px] text-muted-foreground/70">
                  {formatRelative(notification.created_at)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
