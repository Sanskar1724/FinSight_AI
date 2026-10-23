import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
  FlaskConical,
  Info,
  Plus,
  RotateCcw,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Spin } from "@/components/ui/spin";
import { api, ApiError } from "@/lib/api";
import type {
  Category,
  GoalList,
  ScenarioRequest,
  ScenarioResult,
} from "@/lib/types";
import { cn, formatINR, percentage } from "@/lib/utils";

interface ReductionRow {
  key: number;
  categoryId: string;
  percent: string;
}

let rowCounter = 0;

function newRow(categoryId = ""): ReductionRow {
  rowCounter += 1;
  return { key: rowCounter, categoryId, percent: "10" };
}

export default function ScenariosPage() {
  const [rows, setRows] = useState<ReductionRow[]>([newRow()]);
  const [shoppingCut, setShoppingCut] = useState("");
  const [incomeChange, setIncomeChange] = useState("");
  const [additionalSavings, setAdditionalSavings] = useState("");
  const [oneTimeExpense, setOneTimeExpense] = useState("");
  const [months, setMonths] = useState(6);
  const [goalId, setGoalId] = useState("");
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
    staleTime: 10 * 60 * 1000,
  });

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<GoalList>("/goals"),
  });

  const expenses = useMemo(
    () => (categoriesQuery.data ?? []).filter((category) => category.kind === "expense"),
    [categoriesQuery.data],
  );

  const selectedIds = rows.map((row) => row.categoryId).filter(Boolean);
  const availableForRow = (current: string) =>
    expenses.filter(
      (category) =>
        String(category.id) === current || !selectedIds.includes(String(category.id)),
    );

  const mutation = useMutation({
    mutationFn: (payload: ScenarioRequest) =>
      api.post<ScenarioResult>("/scenarios/simulate", payload),
    onSuccess: (data) => {
      setResult(data);
      setError("");
      toast.success("Scenario calculated");
    },
    onError: (err) => {
      setResult(null);
      setError(err instanceof ApiError ? err.message : "Could not calculate this scenario");
    },
  });

  const updateRow = (key: number, patch: Partial<ReductionRow>) => {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (key: number) => {
    setRows((current) => (current.length === 1 ? [newRow()] : current.filter((row) => row.key !== key)));
  };

  const addRow = () => {
    const used = new Set(rows.map((row) => row.categoryId));
    const next = expenses.find((category) => !used.has(String(category.id)));
    setRows((current) => [...current, newRow(next ? String(next.id) : "")]);
  };

  const reset = () => {
    setRows([newRow()]);
    setShoppingCut("");
    setIncomeChange("");
    setAdditionalSavings("");
    setOneTimeExpense("");
    setMonths(6);
    setGoalId("");
    setResult(null);
    setError("");
  };

  const parseAmount = (value: string) => {
    if (!value.trim()) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const submit = () => {
    setError("");
    const reductions = rows
      .filter((row) => row.categoryId && Number(row.percent) > 0)
      .map((row) => ({
        category_id: Number(row.categoryId),
        reduction_percent: Number(row.percent),
      }));

    if (reductions.some((item) => item.reduction_percent > 100)) {
      setError("A category reduction cannot exceed 100%");
      return;
    }

    const values = {
      shopping_reduction_amount: parseAmount(shoppingCut),
      income_change: parseAmount(incomeChange),
      additional_monthly_savings: parseAmount(additionalSavings),
      one_time_expense: parseAmount(oneTimeExpense),
    };
    if (Object.values(values).some((value) => Number.isNaN(value))) {
      setError("Use valid numbers in the amount fields");
      return;
    }
    if (values.one_time_expense < 0 || values.additional_monthly_savings < 0 || values.shopping_reduction_amount < 0) {
      setError("Expenses and savings amounts cannot be negative");
      return;
    }
    if (
      reductions.length === 0 &&
      values.shopping_reduction_amount === 0 &&
      values.income_change === 0 &&
      values.additional_monthly_savings === 0 &&
      values.one_time_expense === 0
    ) {
      setError("Adjust at least one assumption to run a scenario");
      return;
    }

    mutation.mutate({
      category_reductions: reductions,
      shopping_reduction_amount: values.shopping_reduction_amount.toFixed(2),
      income_change: values.income_change.toFixed(2),
      additional_monthly_savings: values.additional_monthly_savings.toFixed(2),
      one_time_expense: values.one_time_expense.toFixed(2),
      months,
      goal_id: goalId ? Number(goalId) : null,
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="What if?"
        title="Scenario lab"
        description="Change one assumption at a time and see the arithmetic. Nothing here changes your real records."
        actions={
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/5 text-primary">
                <Calculator className="size-4" />
              </span>
              <div>
                <CardTitle>Build your scenario</CardTitle>
                <CardDescription>Baseline = last three complete months</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label>Reduce category spending</Label>
                <span className="text-[10px] text-muted-foreground">% off baseline</span>
              </div>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.key} className="flex items-center gap-2">
                    <Select
                      value={row.categoryId}
                      onChange={(event) =>
                        updateRow(row.key, { categoryId: event.target.value })
                      }
                      className="flex-1"
                      aria-label="Expense category"
                    >
                      <option value="">Choose category…</option>
                      {availableForRow(row.categoryId).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                    <div className="relative w-[96px]">
                      <Input
                        inputMode="decimal"
                        value={row.percent}
                        onChange={(event) =>
                          updateRow(row.key, {
                            percent: event.target.value.replace(/[^0-9.]/g, ""),
                          })
                        }
                        className="pr-7"
                        aria-label="Reduction percent"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                        %
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRow(row.key)}
                      aria-label="Remove category reduction"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-8 text-[11px]"
                onClick={addRow}
                disabled={selectedIds.length >= expenses.length}
              >
                <Plus className="size-3.5" />
                Add another category
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="scenario-shopping">
                  Shopping cut <span className="font-normal text-muted-foreground">₹/month</span>
                </Label>
                <Input
                  id="scenario-shopping"
                  inputMode="decimal"
                  placeholder="0"
                  value={shoppingCut}
                  onChange={(event) =>
                    setShoppingCut(event.target.value.replace(/[^0-9.]/g, ""))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scenario-income">
                  Income change <span className="font-normal text-muted-foreground">₹/month</span>
                </Label>
                <Input
                  id="scenario-income"
                  inputMode="decimal"
                  placeholder="0 or -2000"
                  value={incomeChange}
                  onChange={(event) => setIncomeChange(event.target.value.replace(/[^0-9.-]/g, ""))}
                />
                <p className="text-[9px] text-muted-foreground">
                  Positive for a raise, negative for a cut.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scenario-savings">
                  Extra monthly savings{" "}
                  <span className="font-normal text-muted-foreground">₹</span>
                </Label>
                <Input
                  id="scenario-savings"
                  inputMode="decimal"
                  placeholder="0"
                  value={additionalSavings}
                  onChange={(event) =>
                    setAdditionalSavings(event.target.value.replace(/[^0-9.]/g, ""))
                  }
                />
                <p className="text-[9px] text-muted-foreground">
                  A transfer that adds to projected savings.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scenario-onetime">
                  One-time expense <span className="font-normal text-muted-foreground">₹</span>
                </Label>
                <Input
                  id="scenario-onetime"
                  inputMode="decimal"
                  placeholder="0"
                  value={oneTimeExpense}
                  onChange={(event) =>
                    setOneTimeExpense(event.target.value.replace(/[^0-9.]/g, ""))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Horizon</Label>
                  <span className="text-[11px] font-semibold text-primary">{months} months</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={36}
                  value={months}
                  onChange={(event) => setMonths(Number(event.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-emerald-600"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span>1 month</span>
                  <span>3 years</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scenario-goal">Project into a goal</Label>
                <Select
                  id="scenario-goal"
                  value={goalId}
                  onChange={(event) => setGoalId(event.target.value)}
                >
                  <option value="">No goal</option>
                  {(goalsQuery.data?.items ?? []).map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {error}
              </p>
            )}

            <Button className="w-full" onClick={submit} disabled={mutation.isPending}>
              {mutation.isPending ? <Spin /> : <FlaskConical className="size-4" />}
              Run scenario
            </Button>
            <p className="text-center text-[9px] leading-relaxed text-muted-foreground">
              Hypothetical arithmetic only. No records are changed, and no investment returns are
              assumed.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {mutation.isPending ? (
            <Card className="grid min-h-[480px] place-items-center">
              <div className="text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/5 text-primary">
                  <Spin className="size-5" />
                </div>
                <p className="mt-3 text-sm font-semibold">Crunching the numbers</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Averaging history and applying your assumptions…
                </p>
              </div>
            </Card>
          ) : !result ? (
            <Card className="relative min-h-[480px] overflow-hidden">
              <div className="absolute inset-0 surface-grid opacity-40" />
              <div className="relative grid h-full min-h-[480px] place-items-center p-8">
                <EmptyState
                  icon={Sparkles}
                  title="Your what-if starts here"
                  description="Adjust a category cut, an income change, or a one-time expense. The result will show the monthly effect, horizon savings, and an honest list of assumptions."
                  className="py-0"
                />
              </div>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <div className="relative bg-[#071a16] p-6 text-white">
                  <div className="absolute inset-0 surface-grid opacity-25" />
                  <div className="absolute -right-16 -top-16 size-56 rounded-full bg-emerald-400/10 blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/80">
                        Scenario result
                      </p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] text-white/50">
                        {result.horizon_months} month horizon
                      </span>
                    </div>
                    <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[10px] text-white/45">Adjusted monthly net</p>
                        <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] tabular">
                          {formatINR(result.adjusted_net)}
                        </p>
                        <p className="mt-1 text-[10px] text-white/40">
                          Baseline {formatINR(result.baseline_net)}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-2 text-xs font-semibold sm:self-auto",
                          result.monthly_impact >= 0
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-rose-400/15 text-rose-300",
                        )}
                      >
                        {result.monthly_impact >= 0 ? (
                          <ArrowUpRight className="size-4" />
                        ) : (
                          <ArrowDownRight className="size-4" />
                        )}
                        {result.monthly_impact >= 0 ? "+" : ""}
                        {formatINR(result.monthly_impact)} / month
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                      <div>
                        <p className="text-[9px] text-white/35">Income</p>
                        <p className="mt-0.5 text-[11px] font-semibold tabular">
                          {formatINR(result.adjusted_monthly_income)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/35">Expenses</p>
                        <p className="mt-0.5 text-[11px] font-semibold tabular">
                          {formatINR(result.adjusted_monthly_expenses)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/35">One-time</p>
                        <p className="mt-0.5 text-[11px] font-semibold tabular">
                          {formatINR(result.one_time_expense)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60 bg-card">
                  <div className="p-4 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      Projected savings
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular text-emerald-700">
                      {formatINR(result.projected_savings)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      Over {result.horizon_months} months
                    </p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      Baseline expenses
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular">
                      {formatINR(result.baseline_monthly_expenses)}
                    </p>
                    <p className="text-[9px] text-muted-foreground">Monthly average</p>
                  </div>
                </div>
              </Card>

              {result.category_changes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Category impact</CardTitle>
                    <CardDescription>Baseline vs adjusted monthly spending</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.category_changes.map((change) => {
                      const max = Math.max(change.baseline, 1);
                      return (
                        <div key={change.category_id}>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium">{change.name}</span>
                            <span className="font-semibold text-emerald-700 tabular">
                              −{formatINR(change.savings)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex gap-1">
                            <div className="h-1.5 flex-1 rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${(change.adjusted / max) * 100}%` }}
                              />
                            </div>
                            <div className="h-1.5 flex-1 rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-slate-300"
                                style={{ width: `${(change.baseline / max) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="mt-1 flex justify-between text-[9px] text-muted-foreground tabular">
                            <span>Adjusted {formatINR(change.adjusted)}</span>
                            <span>Baseline {formatINR(change.baseline)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {result.goal_projection && (
                <Card className="border-primary/20 bg-gradient-to-br from-emerald-50/60 to-card">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Target className="size-4 text-primary" />
                      <CardTitle>Goal projection</CardTitle>
                    </div>
                    <CardDescription>{result.goal_projection.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-semibold tabular">
                          {formatINR(result.goal_projection.projected_saved)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          from {formatINR(result.goal_projection.current_saved)} today
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular text-primary">
                        {percentage(result.goal_projection.progress_percent)}
                      </span>
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                      {result.goal_projection.note}
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Info className="size-4 text-sky-600" />
                    <CardTitle>Assumptions &amp; limits</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {result.assumptions.map((assumption) => (
                      <li
                        key={assumption}
                        className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground"
                      >
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                        {assumption}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[9px] leading-relaxed text-amber-900/80">
                    {result.disclaimer}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: Wallet,
            title: "Baseline is historical",
            body: "Averages use your last three complete months, not this partial month unless there is no history.",
          },
          {
            icon: TrendingUp,
            title: "No return assumptions",
            body: "Projected savings are cash set aside. Investment growth, taxes, and inflation are excluded.",
          },
          {
            icon: FlaskConical,
            title: "Safe to experiment",
            body: "Scenarios are calculated on demand and never alter transactions, budgets, or goals.",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex gap-3 rounded-xl border border-border bg-card/60 p-4">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-[11px] font-semibold">{item.title}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
