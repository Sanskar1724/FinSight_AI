import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Gauge,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { BudgetDialog } from "@/components/budget-dialog";
import { CategoryIcon } from "@/components/category-icon";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BudgetStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { Budget, BudgetList } from "@/lib/types";
import {
  addMonthsISO,
  cn,
  currentMonthISO,
  formatINR,
  monthLabel,
  percentage,
} from "@/lib/utils";

const riskTone = {
  on_track: "text-emerald-700 bg-emerald-50 border-emerald-200",
  watch: "text-amber-700 bg-amber-50 border-amber-200",
  at_risk: "text-orange-700 bg-orange-50 border-orange-200",
  likely_over: "text-rose-700 bg-rose-50 border-rose-200",
  over: "text-rose-700 bg-rose-50 border-rose-200",
};

const riskLabel = {
  on_track: "On track",
  watch: "Watch",
  at_risk: "At risk",
  likely_over: "Likely over",
  over: "Over budget",
};

export default function BudgetsPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonthISO().slice(0, 7));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);

  const budgetsQuery = useQuery({
    queryKey: ["budgets", month],
    queryFn: () => api.get<BudgetList>(`/budgets?month=${month}`),
  });

  const data = budgetsQuery.data;
  const spentPercent = data
    ? Math.min(100, data.overall_utilization)
    : 0;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const copyMutation = useMutation({
    mutationFn: () => api.post<BudgetList>(`/budgets/copy-previous?month=${month}`),
    onSuccess: (result) => {
      toast.success(`Copied budgets for ${result.items.length} categor${result.items.length === 1 ? "y" : "ies"}`);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not copy last month's budgets"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/budgets/${id}`),
    onSuccess: () => {
      toast.success("Budget deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not delete the budget"),
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const remaining = data ? Math.max(0, data.total_limit - data.total_spend) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Spending guardrails"
        title="Budgets"
        description="Set a limit by category, then let projections warn you before the month gets away."
        actions={
          <>
            {data?.items.length ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyMutation.mutate()}
                disabled={copyMutation.isPending}
              >
                <Copy className="size-3.5" />
                Copy last month
              </Button>
            ) : null}
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              New budget
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMonth(addMonthsISO(`${month}-01`, -1).slice(0, 7))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2 px-2">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <span className="min-w-[116px] text-center text-xs font-semibold">
              {monthLabel(month)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMonth(addMonthsISO(`${month}-01`, 1).slice(0, 7))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setMonth(currentMonthISO().slice(0, 7))}
          className="self-start text-[11px] font-semibold text-primary hover:underline sm:self-auto"
        >
          Back to current month
        </button>
      </div>

      {budgetsQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-48 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : budgetsQuery.isError ? (
        <Card className="py-16 text-center">
          <AlertTriangle className="mx-auto size-6 text-rose-500" />
          <p className="mt-3 text-sm font-semibold">Budgets could not load</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {budgetsQuery.error instanceof ApiError
              ? budgetsQuery.error.message
              : "Please try again."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => budgetsQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Total budget
                </p>
                <Wallet className="size-4 text-primary" />
              </div>
              <p className="mt-2 text-xl font-semibold tabular">
                {formatINR(data?.total_limit ?? 0)}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Across {data?.items.length ?? 0} categories
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Spent so far
                </p>
                <Gauge className="size-4 text-amber-500" />
              </div>
              <p className="mt-2 text-xl font-semibold tabular">{formatINR(data?.total_spend ?? 0)}</p>
              <div className="mt-2 flex items-center gap-2">
                <Progress
                  value={spentPercent}
                  className="h-1.5"
                  indicatorClassName={cn(
                    spentPercent > 100
                      ? "bg-rose-500"
                      : spentPercent > 85
                        ? "bg-amber-400"
                        : "bg-emerald-500",
                  )}
                />
                <span className="shrink-0 text-[10px] font-semibold tabular">
                  {percentage(data?.overall_utilization ?? 0)}
                </span>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Remaining
                </p>
                <span className="text-[10px] font-bold text-primary">₹</span>
              </div>
              <p
                className={cn(
                  "mt-2 text-xl font-semibold tabular",
                  remaining <= 0 ? "text-rose-600" : "text-emerald-700",
                )}
              >
                {formatINR(remaining)}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {remaining <= 0 ? "This month's limits are used up" : "Left across all budgets"}
              </p>
            </Card>
          </div>

          {!data?.items.length ? (
            <Card>
              <EmptyState
                icon={Wallet}
                title={`No budgets for ${monthLabel(month)}`}
                description="Create limits category by category, or copy last month's plan as a starting point."
                action={{
                  label: "Create a budget",
                  onClick: openCreate,
                }}
                className="py-14"
              />
              <div className="flex justify-center pb-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyMutation.mutate()}
                  disabled={copyMutation.isPending}
                >
                  {copyMutation.isPending ? null : <Copy className="size-3.5" />}
                  Try copying last month
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((budget) => {
                const over = budget.remaining < 0;
                return (
                  <Card
                    key={budget.id}
                    className="group overflow-hidden transition-all hover:border-primary/20 hover:shadow-lift"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <CategoryIcon
                            icon={budget.category.icon}
                            color={budget.category.color}
                            className="size-9"
                          />
                          <div className="min-w-0">
                            <CardTitle className="truncate text-sm">
                              {budget.category.name}
                            </CardTitle>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {monthLabel(month)}
                            </p>
                          </div>
                        </div>
                        <BudgetStatusBadge status={budget.status} />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex items-end justify-between">
                          <p className="text-xl font-semibold tracking-[-0.03em] tabular">
                            {formatINR(budget.actual_spend)}
                          </p>
                          <p className="pb-0.5 text-[10px] text-muted-foreground">
                            of {formatINR(budget.limit_amount)}
                          </p>
                        </div>
                        <Progress
                          value={Math.min(100, budget.utilization)}
                          className="mt-2 h-1.5"
                          indicatorClassName={cn(
                            budget.status === "exceeded" || budget.status === "critical"
                              ? "bg-rose-500"
                              : budget.status === "approaching"
                                ? "bg-amber-400"
                                : "bg-emerald-500",
                          )}
                        />
                        <div className="mt-1.5 flex justify-between text-[10px]">
                          <span className="font-semibold tabular">
                            {percentage(budget.utilization)} used
                          </span>
                          <span className={cn("tabular", over ? "text-rose-600" : "text-muted-foreground")}>
                            {over
                              ? `${formatINR(Math.abs(budget.remaining))} over`
                              : `${formatINR(budget.remaining)} left`}
                          </span>
                        </div>
                      </div>

                      {budget.risk && (
                        <div
                          className={cn(
                            "rounded-lg border px-2.5 py-2",
                            riskTone[budget.risk.risk_level],
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold">
                              {riskLabel[budget.risk.risk_level]}
                            </span>
                            <span className="text-[9px] font-medium opacity-75">
                              {budget.risk.reliability} confidence
                            </span>
                          </div>
                          <p className="mt-0.5 text-[9px] leading-relaxed opacity-85">
                            Projected {formatINR(budget.risk.projected_spend)} by month end ·{" "}
                            {budget.risk.remaining_days} days left
                          </p>
                        </div>
                      )}

                      {budget.change_vs_previous !== null && (
                        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {budget.change_vs_previous > 0 ? (
                            <ArrowRight className="size-3 text-rose-500" />
                          ) : (
                            <ArrowLeft className="size-3 text-emerald-600" />
                          )}
                          {Math.abs(budget.change_vs_previous).toFixed(0)}%{" "}
                          {budget.change_vs_previous > 0 ? "more" : "less"} than last month
                        </p>
                      )}

                      <div className="flex items-center justify-between border-t border-border/60 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(budget);
                            setDialogOpen(true);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(budget)}
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-rose-600"
                        >
                          <Trash2 className="size-3" />
                          Delete
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {data?.items.some((item) => item.risk) && (
            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card/60 px-4 py-3">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Projections use the current month&apos;s spending pace, prior-month history, and
                remaining days. They are estimates, not guarantees. Reliability indicates how much
                history is available.
              </p>
            </div>
          )}
        </>
      )}

      <BudgetDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        month={month}
        budget={editing}
        existing={data?.items ?? []}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this budget?"
        description={
          deleting
            ? `The ${deleting.category.name} limit for ${monthLabel(month)} will be removed. Transactions are not affected.`
            : ""
        }
        confirmLabel="Delete budget"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
