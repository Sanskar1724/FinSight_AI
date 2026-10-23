import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleDollarSign,
  Flag,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { ContributionDialog, GoalDialog } from "@/components/goal-dialogs";
import { GoalStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { Goal, GoalContribution, GoalList } from "@/lib/types";
import { cn, formatDate, formatINR, percentage } from "@/lib/utils";

function daysUntil(date: string | null) {
  if (!date) return null;
  const target = new Date(`${date}T23:59:59`);
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

export default function GoalsPage() {
  const queryClient = useQueryClient();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contributing, setContributing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [deletingContribution, setDeletingContribution] = useState<{
    goal: Goal;
    contribution: GoalContribution;
  } | null>(null);

  const goalsQuery = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.get<GoalList>("/goals"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["goals"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/goals/${id}`),
    onSuccess: () => {
      toast.success("Goal deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not delete the goal"),
  });

  const deleteContributionMutation = useMutation({
    mutationFn: ({ goal, contribution }: { goal: Goal; contribution: GoalContribution }) =>
      api.delete<Goal>(`/goals/${goal.id}/contributions/${contribution.id}`),
    onSuccess: () => {
      toast.success("Contribution removed");
      setDeletingContribution(null);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not remove the contribution"),
  });

  const data = goalsQuery.data;
  const onTrack = data?.items.filter((goal) => goal.status === "on_track").length ?? 0;
  const achieved = data?.items.filter((goal) => goal.status === "achieved").length ?? 0;
  const remaining = data ? Math.max(0, data.total_target - data.total_saved) : 0;
  const nearest = data?.items
    .filter((goal) => goal.target_date && goal.status !== "achieved")
    .sort((a, b) => (a.target_date ?? "").localeCompare(b.target_date ?? ""))[0];

  const openCreate = () => {
    setEditing(null);
    setGoalDialogOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="What you're saving for"
        title="Goals"
        description="Give each plan a target, a date, and a pace. Progress is calculated from contributions you record."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            New goal
          </Button>
        }
      />

      {goalsQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-64 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : goalsQuery.isError ? (
        <Card className="py-16 text-center">
          <p className="text-sm font-semibold">Goals could not load</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {goalsQuery.error instanceof ApiError ? goalsQuery.error.message : "Please try again."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => goalsQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : !data?.items.length ? (
        <Card>
          <EmptyState
            icon={Target}
            title="Turn a plan into a target"
            description="Create a savings goal, add contributions as you go, and FinSight will show the honest pace required."
            action={{ label: "Create your first goal", onClick: openCreate }}
            className="py-20"
          />
        </Card>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-[#071a16] p-6 text-white sm:p-8">
            <div className="absolute inset-0 surface-grid opacity-25" />
            <div className="absolute -right-20 -top-24 size-72 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative grid gap-7 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/80">
                  Across {data.items.length} goal{data.items.length === 1 ? "" : "s"}
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <p className="text-3xl font-semibold tracking-[-0.04em] tabular">
                    {formatINR(data.total_saved)}
                  </p>
                  <p className="pb-1 text-sm text-white/45">of {formatINR(data.total_target)}</p>
                </div>
                <div className="mt-4 max-w-xl">
                  <Progress
                    value={data.overall_progress}
                    className="h-2 bg-white/10"
                    indicatorClassName="bg-gradient-to-r from-emerald-400 to-teal-300"
                  />
                  <div className="mt-2 flex justify-between text-[10px] text-white/45">
                    <span>{percentage(data.overall_progress)} funded overall</span>
                    <span>{formatINR(remaining)} to go</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                  <p className="text-[9px] uppercase tracking-wider text-white/35">On track</p>
                  <p className="mt-1 text-xl font-semibold">{onTrack}</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                  <p className="text-[9px] uppercase tracking-wider text-white/35">Achieved</p>
                  <p className="mt-1 text-xl font-semibold">{achieved}</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                  <p className="text-[9px] uppercase tracking-wider text-white/35">Next date</p>
                  <p className="mt-1 truncate text-[11px] font-semibold">
                    {nearest?.target_date ? formatDate(nearest.target_date, "d MMM") : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((goal) => {
              const days = daysUntil(goal.target_date);
              const complete = goal.status === "achieved" || goal.progress_percent >= 100;
              return (
                <Card key={goal.id} className="overflow-hidden transition-all hover:shadow-lift">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className={cn(
                            "grid size-10 shrink-0 place-items-center rounded-xl",
                            complete
                              ? "bg-emerald-600 text-white"
                              : "border border-primary/10 bg-primary/5 text-primary",
                          )}
                        >
                          {complete ? (
                            <CheckCircle2 className="size-5" />
                          ) : (
                            <Flag className="size-[18px]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold">{goal.name}</h3>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {goal.target_date
                              ? complete
                                ? `Reached · target ${formatDate(goal.target_date, "d MMM yyyy")}`
                                : days !== null && days >= 0
                                  ? `${days} day${days === 1 ? "" : "s"} left`
                                  : `${Math.abs(days ?? 0)} days past target`
                              : "Open-ended goal"}
                          </p>
                        </div>
                      </div>
                      <GoalStatusBadge status={goal.status} />
                    </div>

                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-semibold tracking-[-0.035em] tabular">
                          {formatINR(goal.saved_amount)}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          of {formatINR(goal.target_amount)} target
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular text-primary">
                        {percentage(goal.progress_percent)}
                      </span>
                    </div>
                    <Progress value={goal.progress_percent} className="mt-2.5 h-2" />

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-secondary/50 px-2.5 py-2">
                        <p className="text-[9px] font-medium text-muted-foreground">
                          Remaining
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold tabular">
                          {formatINR(goal.remaining_amount)}
                        </p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 px-2.5 py-2">
                        <p className="text-[9px] font-medium text-muted-foreground">
                          {goal.required_monthly !== null ? "Needed / month" : "Avg / month"}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold tabular">
                          {formatINR(
                            goal.required_monthly ?? goal.average_monthly_contribution,
                          )}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 line-clamp-2 min-h-[30px] text-[10px] leading-relaxed text-muted-foreground">
                      {goal.explanation}
                    </p>

                    {goal.behind_by !== null && goal.behind_by > 0 && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-medium text-amber-800">
                        Behind by {formatINR(goal.behind_by)}
                      </p>
                    )}

                    <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3.5">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setContributing(goal);
                          setContributionOpen(true);
                        }}
                        disabled={complete}
                      >
                        <Plus className="size-3.5" />
                        Add money
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => {
                          setEditing(goal);
                          setGoalDialogOpen(true);
                        }}
                        aria-label={`Edit ${goal.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => setDeleting(goal)}
                        aria-label={`Delete ${goal.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>

                    {goal.contributions.length > 0 && (
                      <details className="group mt-3">
                        <summary className="cursor-pointer list-none text-[10px] font-semibold text-muted-foreground hover:text-foreground">
                          {goal.contributions.length} contribution
                          {goal.contributions.length === 1 ? "" : "s"}
                          <span className="ml-1 inline-block transition-transform group-open:rotate-90">
                            ›
                          </span>
                        </summary>
                        <div className="mt-2 space-y-1.5">
                          {goal.contributions.slice(0, 5).map((contribution) => (
                            <div
                              key={contribution.id}
                              className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2.5 py-1.5"
                            >
                              <CircleDollarSign className="size-3 text-emerald-600" />
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-semibold tabular">
                                  {formatINR(contribution.amount)}
                                </p>
                                <p className="truncate text-[9px] text-muted-foreground">
                                  {formatDate(contribution.contributed_on, "d MMM yyyy")}
                                  {contribution.note ? ` · ${contribution.note}` : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeletingContribution({ goal, contribution })
                                }
                                className="text-muted-foreground hover:text-rose-600"
                                aria-label="Remove contribution"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: TrendingUp,
                title: "Pace, not just progress",
                body: `Required monthly savings compare the target date with what you have already put aside.`,
              },
              {
                icon: Wallet,
                title: "Manual by design",
                body: "Contributions are not linked to bank accounts. You record each transfer yourself.",
              },
              {
                icon: Sparkles,
                title: "Test a what-if",
                body: "The scenario lab can project how changed spending affects a chosen goal.",
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
        </>
      )}

      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={(open) => {
          setGoalDialogOpen(open);
          if (!open) setEditing(null);
        }}
        goal={editing}
      />
      <ContributionDialog
        open={contributionOpen}
        onOpenChange={(open) => {
          setContributionOpen(open);
          if (!open) setContributing(null);
        }}
        goal={contributing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this goal?"
        description={
          deleting
            ? `“${deleting.name}” and its ${deleting.contributions.length} contribution(s) will be removed permanently.`
            : ""
        }
        confirmLabel="Delete goal"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
      />
      <ConfirmDialog
        open={Boolean(deletingContribution)}
        onOpenChange={(open) => !open && setDeletingContribution(null)}
        title="Remove this contribution?"
        description={
          deletingContribution
            ? `${formatINR(deletingContribution.contribution.amount)} on ${formatDate(deletingContribution.contribution.contributed_on)} will be removed from “${deletingContribution.goal.name}”.`
            : ""
        }
        confirmLabel="Remove contribution"
        onConfirm={() =>
          deletingContribution && deleteContributionMutation.mutate(deletingContribution)
        }
        loading={deleteContributionMutation.isPending}
      />
    </div>
  );
}
