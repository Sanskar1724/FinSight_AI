import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  Check,
  CircleDollarSign,
  Gauge,
  LineChart,
  RefreshCw,
  Repeat,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/use-tab-param";
import { api, ApiError, buildQuery, downloadBlob } from "@/lib/api";
import type { Analytics, RecurringCandidate } from "@/lib/types";
import {
  addMonthsISO,
  cn,
  currentMonthISO,
  formatDate,
  formatINR,
  formatNumber,
  percentage,
  todayISO,
} from "@/lib/utils";

const ANALYTICS_TABS = ["overview", "patterns", "forecast"] as const;

const frequencyLabels: Record<RecurringCandidate["frequency"], string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  irregular: "Irregular",
};

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-[130px] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-80 rounded-xl" />
      <Skeleton className="h-[360px] rounded-2xl" />
    </div>
  );
}

export default function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [start, setStart] = useState(addMonthsISO(currentMonthISO(), -5));
  const [end, setEnd] = useState(todayISO());
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useTabParam(ANALYTICS_TABS, "overview");
  const invalidRange = start > end;

  const analyticsQuery = useQuery({
    queryKey: ["analytics", { start, end }],
    queryFn: () => api.get<Analytics>(`/analytics${buildQuery({ start, end })}`),
    enabled: !invalidRange,
  });

  const data = analyticsQuery.data;

  const totals = useMemo(() => {
    const income = (data?.monthly_trend ?? []).reduce((sum, item) => sum + item.income, 0);
    const expenses = (data?.monthly_trend ?? []).reduce((sum, item) => sum + item.expenses, 0);
    const avgExpense = data?.monthly_trend.length
      ? expenses / data.monthly_trend.length
      : 0;
    const onTrack = data?.budget_adherence.filter((item) => item.on_track).length ?? 0;
    const budgetCount = data?.budget_adherence.length ?? 0;
    return {
      income,
      expenses,
      net: income - expenses,
      avgExpense,
      onTrack,
      budgetCount,
      adherence: budgetCount ? (onTrack / budgetCount) * 100 : 0,
    };
  }, [data]);

  const setQuickRange = (months: number | "ytd") => {
    const today = new Date();
    if (months === "ytd") {
      setStart(`${today.getFullYear()}-01-01`);
    } else {
      setStart(addMonthsISO(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`, -(months - 1)));
    }
    setEnd(todayISO());
  };

  const invalidateAnalytics = () => {
    void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const recurringFeedback = useMutation({
    mutationFn: ({ key, status }: { key: string; status: "confirmed" | "dismissed" }) =>
      api.post(`/analytics/recurring/${encodeURIComponent(key)}/feedback`, { status }),
    onSuccess: (_, variables) => {
      toast.success(`Marked ${variables.status === "confirmed" ? "confirmed" : "dismissed"}`);
      invalidateAnalytics();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not save the feedback"),
  });

  const anomalyFeedback = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "confirmed" | "dismissed" }) =>
      api.post(`/analytics/anomalies/${id}/feedback`, { status }),
    onSuccess: (_, variables) => {
      toast.success(`Unusual spend ${variables.status === "confirmed" ? "confirmed" : "dismissed"}`);
      invalidateAnalytics();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not save the feedback"),
  });

  const exportReport = async () => {
    setExporting(true);
    try {
      await downloadBlob(
        `/analytics/report${buildQuery({ start, end })}`,
        `finsight-report-${start}-to-${end}.csv`,
      );
      toast.success("Report downloaded");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Report export failed");
    } finally {
      setExporting(false);
    }
  };

  if (analyticsQuery.isLoading) return <AnalyticsSkeleton />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Patterns & projections"
        title="Analytics"
        description="Read the shape of your money over time, spot repeating payments, and see forecasts with their limitations."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => analyticsQuery.refetch()}>
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={exportReport}
              disabled={exporting || invalidRange}
            >
              {exporting ? <RefreshCw className="size-3.5 animate-spin" /> : <ArrowDownToLine className="size-3.5" />}
              Export report
            </Button>
          </>
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarRange className="size-4 text-primary" />
            <span className="text-[11px] font-semibold text-muted-foreground">Range</span>
            <div className="flex gap-1">
              {[
                { label: "3M", value: 3 },
                { label: "6M", value: 6 },
                { label: "12M", value: 12 },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setQuickRange(item.value)}
                  className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:border-primary/30 hover:text-foreground"
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setQuickRange("ytd")}
                className="rounded-lg border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:border-primary/30 hover:text-foreground"
              >
                YTD
              </button>
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end sm:justify-end">
            <div className="space-y-1">
              <label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                From
              </label>
              <input
                type="date"
                value={start}
                max={end}
                onChange={(event) => setStart(event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-xs shadow-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:w-[150px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                To
              </label>
              <input
                type="date"
                value={end}
                min={start}
                max={todayISO()}
                onChange={(event) => setEnd(event.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-xs shadow-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/15 sm:w-[150px]"
              />
            </div>
          </div>
        </div>
        {invalidRange && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
            <AlertCircle className="size-3.5" />
            The start date must be on or before the end date.
          </p>
        )}
      </Card>

      {analyticsQuery.isError ? (
        <Card className="py-16 text-center">
          <AlertCircle className="mx-auto size-6 text-rose-500" />
          <p className="mt-3 text-sm font-semibold">Analytics could not load</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {analyticsQuery.error instanceof ApiError
              ? analyticsQuery.error.message
              : "Check the date range and try again."}
          </p>
        </Card>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <MetricCard
              label="Income in range"
              value={formatINR(totals.income)}
              icon={ArrowDownLeft}
              hint={`${data.monthly_trend.length} month${data.monthly_trend.length === 1 ? "" : "s"} of records`}
              accent="emerald"
            />
            <MetricCard
              label="Spending in range"
              value={formatINR(totals.expenses)}
              icon={ArrowUpRight}
              hint={`Avg ${formatINR(totals.avgExpense)} / month`}
              accent="amber"
            />
            <MetricCard
              label="Net in range"
              value={formatINR(totals.net)}
              icon={Wallet}
              hint="Period cash flow, not account balance"
              accent="sky"
            />
            <MetricCard
              label="Budgets on track"
              value={
                totals.budgetCount
                  ? `${totals.onTrack} of ${totals.budgetCount}`
                  : "—"
              }
              icon={Target}
              hint={
                totals.budgetCount
                  ? `${percentage(totals.adherence)} healthy or approaching`
                  : "No budgets for the range end month"
              }
              accent="violet"
            />
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto">
              <TabsTrigger value="overview">Trends &amp; categories</TabsTrigger>
              <TabsTrigger value="patterns">Recurring &amp; unusual</TabsTrigger>
              <TabsTrigger value="forecast">Forecast &amp; method</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-12">
                <Card className="lg:col-span-8">
                  <CardHeader>
                    <CardTitle>Monthly income, spending, and net</CardTitle>
                    <CardDescription>
                      Complete and partial months inside the selected range
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.monthly_trend.length === 0 ? (
                      <EmptyState
                        icon={BarChart3}
                        title="No monthly data"
                        description="Add transactions within this range to see the trend."
                        className="py-12"
                      />
                    ) : (
                      <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            data={data.monthly_trend}
                            margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid
                              vertical={false}
                              stroke="#e8efec"
                              strokeDasharray="4 4"
                            />
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
                              width={52}
                              tickFormatter={(value) => formatINR(Number(value), true)}
                            />
                            <Tooltip content={<ChartTooltip />} />
                            <Bar
                              dataKey="income"
                              name="Income"
                              fill="#34d399"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={24}
                            />
                            <Bar
                              dataKey="expenses"
                              name="Expenses"
                              fill="#fbbf24"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={24}
                            />
                            <Line
                              type="monotone"
                              dataKey="net"
                              name="Net"
                              stroke="#0f766e"
                              strokeWidth={2.5}
                              dot={{ r: 3, fill: "#0f766e", strokeWidth: 0 }}
                              activeDot={{ r: 4 }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-4">
                  <CardHeader>
                    <CardTitle>Category mix</CardTitle>
                    <CardDescription>Spending share in the selected range</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.category_breakdown.length === 0 ? (
                      <EmptyState
                        icon={LineChart}
                        title="No spending"
                        description="Nothing to break down in this range."
                        className="py-8"
                      />
                    ) : (
                      <>
                        <div className="relative mx-auto h-[170px] max-w-[210px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={data.category_breakdown}
                                dataKey="amount"
                                nameKey="name"
                                innerRadius={52}
                                outerRadius={76}
                                paddingAngle={2}
                                strokeWidth={0}
                              >
                                {data.category_breakdown.map((item) => (
                                  <Cell key={item.category_id} fill={item.color} />
                                ))}
                              </Pie>
                              <Tooltip content={<ChartTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 grid place-items-center">
                            <div className="text-center">
                              <p className="text-[9px] text-muted-foreground">Categories</p>
                              <p className="text-lg font-bold">
                                {data.category_breakdown.length}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 max-h-[190px] space-y-2 overflow-y-auto pr-1">
                          {data.category_breakdown.map((item) => (
                            <div
                              key={item.category_id}
                              className="flex items-center gap-2 text-[11px]"
                            >
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="flex-1 truncate text-muted-foreground">
                                {item.name}
                              </span>
                              <span className="font-semibold tabular">
                                {formatINR(item.amount)}
                              </span>
                              <span className="w-9 text-right text-[10px] text-muted-foreground">
                                {percentage(item.percent)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-7">
                  <CardHeader>
                    <CardTitle>Category change</CardTitle>
                    <CardDescription>
                      Selected range compared with the immediately preceding period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.category_comparison.length === 0 ? (
                      <EmptyState
                        icon={BarChart3}
                        title="Nothing to compare"
                        description="Add spending to see how categories changed."
                        className="py-8"
                      />
                    ) : (
                      <div className="space-y-3.5">
                        {data.category_comparison.slice(0, 7).map((item) => {
                          const max = Math.max(item.current, item.previous, 1);
                          return (
                            <div key={item.category_id}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className="size-2 rounded-full"
                                    style={{ backgroundColor: item.color }}
                                  />
                                  <span className="truncate text-[11px] font-medium">
                                    {item.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-[10px]">
                                  <span className="font-semibold tabular">
                                    {formatINR(item.current)}
                                  </span>
                                  {item.change !== null ? (
                                    <span
                                      className={cn(
                                        "w-12 text-right font-semibold tabular",
                                        item.change > 0 ? "text-rose-600" : "text-emerald-700",
                                      )}
                                    >
                                      {item.change > 0 ? "+" : ""}
                                      {item.change.toFixed(0)}%
                                    </span>
                                  ) : (
                                    <span
                                      className="w-16 text-right text-[10px] text-muted-foreground"
                                      title="No spending in this category during the comparison period"
                                    >
                                      no prior
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-1.5 flex gap-1">
                                <div className="h-1.5 flex-1 rounded-full bg-secondary">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${(item.current / max) * 100}%`,
                                      backgroundColor: item.color,
                                    }}
                                  />
                                </div>
                                <div className="h-1.5 flex-1 rounded-full bg-secondary">
                                  <div
                                    className="h-full rounded-full bg-slate-300"
                                    style={{ width: `${(item.previous / max) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-4 border-t border-border/60 pt-3 text-[9px] text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-5 rounded-full bg-emerald-500" />
                            Selected range
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-5 rounded-full bg-slate-300" />
                            Previous period
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-5">
                  <CardHeader>
                    <CardTitle>Budget adherence</CardTitle>
                    <CardDescription>Limits for the end month of this range</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.budget_adherence.length === 0 ? (
                      <EmptyState
                        icon={Gauge}
                        title="No budgets for this month"
                        description="Create category budgets to compare limits with actual spending."
                        className="py-8"
                      />
                    ) : (
                      <div className="space-y-3">
                        {data.budget_adherence.map((item) => (
                          <div key={item.category_id}>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="truncate font-medium">{item.category_name}</span>
                              <span className="font-semibold tabular">
                                {percentage(item.utilization)}
                              </span>
                            </div>
                            <Progress
                              value={Math.min(100, item.utilization)}
                              className="mt-1.5 h-1.5"
                              indicatorClassName={cn(
                                item.status === "exceeded" || item.status === "critical"
                                  ? "bg-rose-500"
                                  : item.status === "approaching"
                                    ? "bg-amber-400"
                                    : "bg-emerald-500",
                              )}
                            />
                            <p className="mt-1 text-[9px] text-muted-foreground tabular">
                              {formatINR(item.actual_spend)} of {formatINR(item.limit_amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="patterns" className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>Recurring payments</CardTitle>
                    <CardDescription>
                      Patterns detected across the last ~7 months of records. Confirm or dismiss to
                      tune future results.
                    </CardDescription>
                  </div>
                  <Repeat className="size-4 text-primary" />
                </CardHeader>
                <CardContent>
                  {data.recurring.length === 0 ? (
                    <EmptyState
                      icon={Repeat}
                      title="No recurring payments detected"
                      description="At least three payments to the same merchant, at a regular interval, are needed."
                      className="py-10"
                    />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {data.recurring.map((item) => (
                        <div
                          key={item.merchant_key}
                          className="rounded-xl border border-border bg-background/40 p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold">{item.merchant}</p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {item.category_name} · {frequencyLabels[item.frequency]}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[9px] font-semibold capitalize",
                                item.status === "confirmed"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : item.status === "dismissed"
                                    ? "border-slate-200 bg-slate-50 text-slate-500"
                                    : "border-sky-200 bg-sky-50 text-sky-700",
                              )}
                            >
                              {item.status}
                            </span>
                          </div>
                          <div className="mt-3 flex items-end justify-between">
                            <div>
                              <p className="text-base font-semibold tabular">
                                {formatINR(item.average_amount)}
                              </p>
                              <p className="text-[9px] text-muted-foreground">
                                {item.occurrences} payments · last{" "}
                                {formatDate(item.last_seen, "d MMM")}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-semibold text-primary">
                                {Math.round(item.confidence * 100)}%
                              </p>
                              <p className="text-[8px] text-muted-foreground">confidence</p>
                            </div>
                          </div>
                          <p className="mt-2 line-clamp-2 text-[9px] leading-relaxed text-muted-foreground">
                            {item.explanation}
                          </p>
                          <div className="mt-3 flex gap-1.5 border-t border-border/60 pt-2.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 flex-1 text-[10px]"
                              onClick={() =>
                                recurringFeedback.mutate({
                                  key: item.merchant_key,
                                  status: "confirmed",
                                })
                              }
                              disabled={
                                item.status === "confirmed" || recurringFeedback.isPending
                              }
                            >
                              <Check className="size-3" />
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 flex-1 text-[10px]"
                              onClick={() =>
                                recurringFeedback.mutate({
                                  key: item.merchant_key,
                                  status: "dismissed",
                                })
                              }
                              disabled={
                                item.status === "dismissed" || recurringFeedback.isPending
                              }
                            >
                              <X className="size-3" />
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>Unusual spending</CardTitle>
                    <CardDescription>
                      Statistical outliers by merchant category, using median absolute deviation.
                      These are indicators, not fraud alerts.
                    </CardDescription>
                  </div>
                  <ShieldAlert className="size-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  {data.anomalies.length === 0 ? (
                    <EmptyState
                      icon={ShieldAlert}
                      title="No unusual spending found"
                      description="This check needs enough history in a category to establish a normal range."
                      className="py-10"
                    />
                  ) : (
                    <div className="space-y-2">
                      {data.anomalies.map((item) => (
                        <div
                          key={item.transaction_id}
                          className="flex flex-col gap-3 rounded-xl border border-border p-3.5 sm:flex-row sm:items-center"
                        >
                          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600">
                            <AlertCircle className="size-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold">{item.merchant}</p>
                              <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                {item.category_name}
                              </span>
                              {item.feedback && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold capitalize text-slate-500">
                                  {item.feedback}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                              {formatINR(item.amount)} on {formatDate(item.occurred_on)} · median{" "}
                              {formatINR(item.median_amount)} across {item.sample_size} similar
                              purchases
                            </p>
                            <p className="mt-0.5 line-clamp-1 text-[9px] text-muted-foreground/80">
                              {item.explanation}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="mr-1 text-right">
                              <span className="block text-[11px] font-bold tabular text-amber-600">
                                {formatNumber(item.score, "×")}
                              </span>
                              <span className="block text-[8px] text-muted-foreground">
                                deviation
                              </span>
                            </span>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              onClick={() =>
                                anomalyFeedback.mutate({
                                  id: item.transaction_id,
                                  status: "confirmed",
                                })
                              }
                              disabled={item.feedback === "confirmed" || anomalyFeedback.isPending}
                              aria-label="Confirm unusual spending"
                            >
                              <Check className="size-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                anomalyFeedback.mutate({
                                  id: item.transaction_id,
                                  status: "dismissed",
                                })
                              }
                              disabled={item.feedback === "dismissed" || anomalyFeedback.isPending}
                              aria-label="Dismiss unusual spending"
                            >
                              <X className="size-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="forecast" className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-12">
                <Card className="lg:col-span-5">
                  <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle>Next-month spending</CardTitle>
                      <CardDescription>Rolling-average forecast with a range</CardDescription>
                    </div>
                    <TrendingUp className="size-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    {data.forecast.length === 0 ? (
                      <EmptyState
                        icon={TrendingUp}
                        title="Not enough complete months"
                        description="At least one complete month of expenses is required before forecasting."
                        className="py-8"
                      />
                    ) : (
                      data.forecast.map((point) => (
                        <div key={point.month}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {point.label}
                          </p>
                          <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] tabular">
                            {formatINR(point.predicted)}
                          </p>
                          <div className="mt-4 rounded-xl border border-primary/10 bg-primary/[0.035] p-3">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>Lower estimate</span>
                              <span>Upper estimate</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-xs font-semibold tabular">
                                {formatINR(point.lower)}
                              </span>
                              <div className="mx-3 h-1.5 flex-1 rounded-full bg-gradient-to-r from-emerald-200 via-emerald-400 to-amber-200" />
                              <span className="text-xs font-semibold tabular">
                                {formatINR(point.upper)}
                              </span>
                            </div>
                          </div>
                          <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
                            This is a planning range based only on your completed months. It does
                            not know about upcoming one-off expenses.
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="lg:col-span-7">
                  <CardHeader>
                    <CardTitle>How the forecast performs</CardTitle>
                    <CardDescription>
                      A backtest on your own history, not a generic accuracy claim
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-[10px] text-muted-foreground">Method</p>
                        <p className="mt-1 text-[13px] font-semibold">{data.backtest.method}</p>
                        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                          Baseline: {data.backtest.baseline_method}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-[10px] text-muted-foreground">Backtest sample</p>
                        <p className="mt-1 text-[13px] font-semibold">
                          {data.backtest.sample_size} month
                          {data.backtest.sample_size === 1 ? "" : "s"}
                        </p>
                        <p className="mt-2 text-[10px] text-muted-foreground">
                          More history generally means a more useful range.
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-[10px] text-muted-foreground">
                          Mean absolute error
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular">
                          {data.backtest.mae === null ? "—" : formatINR(data.backtest.mae)}
                        </p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          Baseline:{" "}
                          {data.backtest.baseline_mae === null
                            ? "—"
                            : formatINR(data.backtest.baseline_mae)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <p className="text-[10px] text-muted-foreground">
                          Mean absolute percentage error
                        </p>
                        <p className="mt-1 text-lg font-semibold tabular">
                          {data.backtest.mape === null
                            ? "—"
                            : percentage(data.backtest.mape)}
                        </p>
                        <p className="mt-1 text-[9px] text-muted-foreground">
                          Lower is better on this sample.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
                        <AlertCircle className="size-3.5" />
                        Read this honestly
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-amber-900/75">
                        {data.backtest.note}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-7">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <CardTitle>Assumptions behind the number</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2.5">
                      {data.forecast_assumptions.map((assumption) => (
                        <li
                          key={assumption}
                          className="flex items-start gap-2.5 text-[11px] leading-relaxed text-muted-foreground"
                        >
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/60" />
                          {assumption}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-5">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CircleDollarSign className="size-4 text-primary" />
                      <CardTitle>What this can’t tell you</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-[11px] leading-relaxed text-muted-foreground">
                    <p>
                      It cannot predict a medical emergency, a trip, a festival splurge, or an
                      income change. Those belong in the scenario lab.
                    </p>
                    <p>
                      It uses only expenses you have recorded in FinSight. Cash spending you did
                      not log is invisible to it.
                    </p>
                    <p>
                      A range is intentionally shown instead of a single “accurate” number.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <p className="text-center text-[10px] text-muted-foreground">
            Generated {formatDate(data.generated_at)} · Period {formatDate(data.period.start)} to{" "}
            {formatDate(data.period.end)}
          </p>
        </>
      ) : null}
    </div>
  );
}
