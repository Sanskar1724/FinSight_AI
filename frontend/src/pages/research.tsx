import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  Download,
  FileJson,
  FileSpreadsheet,
  FlaskConical,
  Layers,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spin } from "@/components/ui/spin";
import { Switch } from "@/components/ui/switch";
import { api, ApiError, downloadBlob } from "@/lib/api";
import type {
  AIStatus,
  ResearchCase,
  ResearchResponse,
  ResearchRun,
  ResearchRunDetail,
  ResearchScore,
} from "@/lib/types";
import {
  cn,
  formatDate,
  formatRelative,
  percentage,
  titleFromSlug,
} from "@/lib/utils";

type RunStatus = ResearchRun["status"];
type Mode = "baseline" | "grounded";

const statusMeta: Record<
  RunStatus,
  {
    label: string;
    variant: "neutral" | "info" | "success" | "danger";
    icon: typeof Clock3;
    dot: string;
  }
> = {
  queued: {
    label: "Queued",
    variant: "neutral",
    icon: Clock3,
    dot: "bg-slate-400",
  },
  running: {
    label: "Running",
    variant: "info",
    icon: Activity,
    dot: "bg-sky-500 animate-pulse",
  },
  completed: {
    label: "Completed",
    variant: "success",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    variant: "danger",
    icon: XCircle,
    dot: "bg-rose-500",
  },
};

const scoreDimensions = [
  {
    key: "score_correctness",
    shortKey: "correctness" as keyof ResearchScore,
    label: "Factual correctness",
    description: "Calculated figures required by the question are present.",
  },
  {
    key: "score_relevance",
    shortKey: "relevance" as keyof ResearchScore,
    label: "Relevance",
    description: "The answer stays connected to what was asked.",
  },
  {
    key: "score_grounding",
    shortKey: "grounding" as keyof ResearchScore,
    label: "Grounding",
    description: "Key figures and references are traceable to supplied context.",
  },
  {
    key: "score_unsupported",
    shortKey: "unsupported" as keyof ResearchScore,
    label: "Claim safety",
    description: "No guarantees, invented figures, or unsupported assertions. Higher is safer.",
  },
  {
    key: "score_usefulness",
    shortKey: "usefulness" as keyof ResearchScore,
    label: "Usefulness",
    description: "Practical, readable, and appropriately qualified.",
  },
  {
    key: "total_score",
    shortKey: "total" as keyof ResearchScore,
    label: "Overall",
    description: "Mean of the five rubric dimensions, each scored out of 5.",
  },
] as const;

const modeMeta: Record<Mode, { label: string; className: string; icon: typeof Layers }> = {
  baseline: {
    label: "Baseline",
    className: "border-slate-200 bg-slate-50 text-slate-700",
    icon: CircleDashed,
  },
  grounded: {
    label: "Grounded",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: Sparkles,
  },
};

function StatusBadge({ status }: { status: RunStatus }) {
  const meta = statusMeta[status];
  return (
    <Badge variant={meta.variant} className="capitalize">
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </Badge>
  );
}

function averageFor(
  run: ResearchRun | null | undefined,
  mode: Mode,
  metric: string,
): number | null {
  return run?.summary?.modes?.[mode]?.averages?.[metric] ?? null;
}

function scoreTone(value: number | null) {
  if (value === null) return "text-muted-foreground";
  if (value >= 4) return "text-emerald-700";
  if (value >= 3) return "text-amber-700";
  return "text-rose-600";
}

function RunDialog({
  open,
  onOpenChange,
  cases,
  isRunning,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cases: ResearchCase[];
  isRunning: boolean;
  onSubmit: (caseIds: number[]) => void;
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (open) setSelected(cases.map((item) => item.id));
  }, [open, cases]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ResearchCase[]>();
    cases.forEach((item) => {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    });
    return Array.from(groups.entries());
  }, [cases]);

  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  const toggleGroup = (ids: number[]) => {
    const allSelected = ids.every((id) => selected.includes(id));
    setSelected((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : Array.from(new Set([...current, ...ids])),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start a research run</DialogTitle>
          <DialogDescription>
            Each selected case is answered twice: once without context, then with calculated facts
            and retrieved references. Both answers are scored by rubric-v1.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3">
          <div>
            <p className="text-xs font-semibold">
              {selected.length} of {cases.length} cases selected
            </p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {selected.length * 2} answers will be generated and scored.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setSelected(cases.map((item) => item.id))}
            >
              Select all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => setSelected([])}
            >
              Clear
            </Button>
          </div>
        </div>

        {isRunning && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            <p className="text-[10px] leading-relaxed text-amber-900/80">
              A run is already active. Wait for it to finish before starting another, especially with
              a hosted AI provider.
            </p>
          </div>
        )}

        <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
          {grouped.map(([category, items]) => {
            const allSelected = items.every((item) => selected.includes(item.id));
            return (
              <div key={category} className="rounded-xl border border-border">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold">
                      {titleFromSlug(category)}
                    </span>
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                      {items.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleGroup(items.map((item) => item.id))}
                    className="text-[10px] font-semibold text-primary hover:underline"
                  >
                    {allSelected ? "Deselect group" : "Select group"}
                  </button>
                </div>
                <div className="space-y-1 p-2">
                  {items.map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary/40"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={() => toggle(item.id)}
                        className="mt-0.5 size-3.5 shrink-0 accent-emerald-700"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-medium">
                          {item.question_template}
                        </span>
                        <span className="mt-0.5 line-clamp-1 block text-[9px] text-muted-foreground">
                          {item.focus}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(selected)}
            disabled={!selected.length || submitting || isRunning}
          >
            {submitting ? <Spin /> : <Play className="size-3.5" />}
            Run {selected.length ? `${selected.length} cases` : "research"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScoreBar({
  label,
  description,
  baseline,
  grounded,
  delta,
}: {
  label: string;
  description: string;
  baseline: number | null;
  grounded: number | null;
  delta: number | null;
}) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold">{label}</p>
          <p className="mt-0.5 text-[9px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground">
          {baseline === null ? "—" : baseline.toFixed(2)}
          <span className="mx-1.5 text-muted-foreground/40">→</span>
          <span className={scoreTone(grounded)}>{grounded === null ? "—" : grounded.toFixed(2)}</span>
          {delta !== null && (
            <span
              className={cn(
                "ml-2 rounded-full px-1.5 py-0.5 text-[9px]",
                delta > 0
                  ? "bg-emerald-50 text-emerald-700"
                  : delta < 0
                    ? "bg-rose-50 text-rose-700"
                    : "bg-secondary text-muted-foreground",
              )}
            >
              {delta > 0 ? "+" : ""}
              {delta.toFixed(2)}
            </span>
          )}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-slate-400"
            style={{ width: `${((baseline ?? 0) / 5) * 100}%` }}
          />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${((grounded ?? 0) / 5) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ResponseBlock({
  mode,
  response,
}: {
  mode: Mode;
  response: ResearchResponse | undefined;
}) {
  const meta = modeMeta[mode];
  if (!response) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-center text-[10px] text-muted-foreground">
        No {meta.label.toLowerCase()} response recorded.
      </div>
    );
  }
  const Icon = meta.icon;
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold",
            meta.className,
          )}
        >
          <Icon className="size-3" />
          {meta.label}
        </span>
        <span className={cn("text-[11px] font-bold tabular", scoreTone(response.scores.total))}>
          {response.scores.total === null ? "—" : response.scores.total.toFixed(2)}
          <span className="ml-1 text-[8px] font-medium text-muted-foreground">/ 5</span>
        </span>
      </div>
      <p className="mt-2.5 whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/85">
        {response.response}
      </p>
      {response.failure_notes && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[9px] leading-relaxed text-amber-800">
          {response.failure_notes}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-[9px] text-muted-foreground">
        <span>Correctness {response.scores.correctness?.toFixed(1) ?? "—"}</span>
        <span>Relevance {response.scores.relevance?.toFixed(1) ?? "—"}</span>
        <span>Grounding {response.scores.grounding?.toFixed(1) ?? "—"}</span>
        <span>Claim safety {response.scores.unsupported?.toFixed(1) ?? "—"}</span>
        <span>Usefulness {response.scores.usefulness?.toFixed(1) ?? "—"}</span>
      </div>
    </div>
  );
}

function RunResults({
  detail,
  casesById,
  showFailuresOnly,
}: {
  detail: ResearchRunDetail;
  casesById: Map<number, ResearchCase>;
  showFailuresOnly: boolean;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<number, { baseline?: ResearchResponse; grounded?: ResearchResponse }>();
    detail.responses.forEach((response) => {
      const entry = groups.get(response.case_id) ?? {};
      entry[response.mode] = response;
      groups.set(response.case_id, entry);
    });
    return Array.from(groups.entries());
  }, [detail.responses]);

  const filtered = grouped.filter(([, pair]) => {
    if (!showFailuresOnly) return true;
    return Boolean(pair.baseline?.failure_notes || pair.grounded?.failure_notes);
  });

  if (!grouped.length) {
    return (
      <div className="grid place-items-center py-14 text-center">
        <CircleDashed className="size-6 text-muted-foreground/50" />
        <p className="mt-2 text-sm font-semibold">Responses are still being generated</p>
        <p className="mt-1 max-w-sm text-[10px] leading-relaxed text-muted-foreground">
          This view polls automatically. Each case produces a baseline and a grounded answer.
        </p>
      </div>
    );
  }

  if (!filtered.length) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="No responses with failure notes"
        description="Turn off the failure filter to see every evaluated response."
        className="py-10"
      />
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map(([caseId, pair]) => {
        const researchCase = casesById.get(caseId);
        const question = pair.grounded?.question ?? pair.baseline?.question ?? "Research case";
        return (
          <details
            key={caseId}
            className="group rounded-xl border border-border bg-card [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
              <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary">
                <BookOpen className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    {researchCase ? titleFromSlug(researchCase.category) : "Case"}
                  </span>
                  {researchCase && (
                    <span className="font-mono text-[9px] text-muted-foreground/70">
                      {researchCase.slug}
                    </span>
                  )}
                  {pair.baseline?.failure_notes && pair.grounded?.failure_notes && (
                    <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700">
                      Both modes flagged
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] font-semibold leading-relaxed">{question}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground">
                  <span>
                    Baseline{" "}
                    <span className="font-semibold text-foreground/80">
                      {pair.baseline?.scores.total?.toFixed(2) ?? "—"}
                    </span>
                  </span>
                  <span className="text-muted-foreground/30">·</span>
                  <span>
                    Grounded{" "}
                    <span className="font-semibold text-emerald-700">
                      {pair.grounded?.scores.total?.toFixed(2) ?? "—"}
                    </span>
                  </span>
                </div>
              </div>
              <ChevronDown className="mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-border/60 p-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <ResponseBlock mode="baseline" response={pair.baseline} />
                <ResponseBlock mode="grounded" response={pair.grounded} />
              </div>
              {pair.grounded && (
                <div className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold">Evidence used</p>
                    {pair.grounded.evidence.length ? (
                      <div className="mt-1.5 space-y-1.5">
                        {pair.grounded.evidence.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg bg-secondary/40 px-2.5 py-2 text-[9px] leading-relaxed"
                          >
                            <span className="font-semibold">{item.label}:</span> {item.value}
                            <span className="mt-0.5 block text-muted-foreground">{item.source}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[9px] text-muted-foreground">
                        No calculated evidence was supplied for this case.
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold">Retrieved references</p>
                    {pair.grounded.retrieval.length ? (
                      <div className="mt-1.5 space-y-1.5">
                        {pair.grounded.retrieval.map((source) => (
                          <div
                            key={source.chunk_id}
                            className="rounded-lg bg-secondary/40 px-2.5 py-2 text-[9px] leading-relaxed"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{source.title}</span>
                              <span className="shrink-0 text-muted-foreground">
                                {percentage(source.similarity * 100)}
                              </span>
                            </div>
                            <span className="mt-0.5 block line-clamp-3 text-muted-foreground">
                              {source.snippet}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[9px] text-muted-foreground">
                        No knowledge reference was retrieved for this case.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export default function ResearchPage() {
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ResearchRun | null>(null);
  const [showFailuresOnly, setShowFailuresOnly] = useState(false);
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);

  const casesQuery = useQuery({
    queryKey: ["research", "cases"],
    queryFn: () => api.get<ResearchCase[]>("/research/cases"),
    staleTime: 5 * 60_000,
  });

  const runsQuery = useQuery({
    queryKey: ["research", "runs"],
    queryFn: () => api.get<ResearchRun[]>("/research/runs"),
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.some((run) => run.status === "queued" || run.status === "running")
        ? 3_000
        : false;
    },
  });

  const aiQuery = useQuery({
    queryKey: ["ai", "status"],
    queryFn: () => api.get<AIStatus>("/ai/status"),
    staleTime: 60_000,
  });

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const activeRun = runs.find((run) => run.status === "queued" || run.status === "running") ?? null;
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? null;

  useEffect(() => {
    if (!runs.length) {
      if (selectedRunId !== null) setSelectedRunId(null);
      return;
    }
    if (selectedRunId === null || !runs.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  const detailQuery = useQuery({
    queryKey: ["research", "run", selectedRunId],
    queryFn: () => api.get<ResearchRunDetail>(`/research/runs/${selectedRunId}`),
    enabled: selectedRunId !== null,
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.status === "queued" || data?.status === "running" ? 2_000 : false;
    },
  });

  const detail = detailQuery.data;

  useEffect(() => {
    if (detail?.status === "completed" || detail?.status === "failed") {
      void queryClient.invalidateQueries({ queryKey: ["research", "runs"] });
    }
  }, [detail?.status, queryClient]);

  const createRun = useMutation({
    mutationFn: (caseIds: number[]) =>
      api.post<ResearchRun>("/research/runs", { case_ids: caseIds }),
    onSuccess: (run) => {
      setSelectedRunId(run.id);
      setRunDialogOpen(false);
      setShowFailuresOnly(false);
      toast.success("Research run started", {
        description: `${run.total_cases * 2} answers will be generated and scored.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["research", "runs"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not start the research run"),
  });

  const deleteRun = useMutation({
    mutationFn: (id: number) => api.delete<{ message: string }>(`/research/runs/${id}`),
    onSuccess: (data) => {
      toast.success(data.message);
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["research", "runs"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not delete the run"),
  });

  const casesById = useMemo(() => {
    const map = new Map<number, ResearchCase>();
    Object.values(detail?.case_lookup ?? {}).forEach((item) => map.set(item.id, item));
    return map;
  }, [detail]);

  const baselineTotal = averageFor(selectedRun, "baseline", "total_score");
  const groundedTotal = averageFor(selectedRun, "grounded", "total_score");
  const totalDelta =
    selectedRun?.summary?.delta_grounded_minus_baseline?.total_score ?? null;
  const completedCount = detail?.responses.length ?? 0;
  const expectedCount = (selectedRun?.total_cases ?? 0) * 2;
  const progress = expectedCount ? (completedCount / expectedCount) * 100 : 0;

  const exportRun = async (format: "json" | "csv") => {
    if (!selectedRun) return;
    setExporting(format);
    try {
      await downloadBlob(
        `/research/runs/${selectedRun.id}/export?format=${format}`,
        `finsight-research-run-${selectedRun.id}.${format}`,
      );
      toast.success(`Research run exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const selectedStatus = selectedRun ? statusMeta[selectedRun.status] : null;
  const isActive = selectedRun
    ? selectedRun.status === "queued" || selectedRun.status === "running"
    : false;
  const hasResponses = (selectedRun?.response_count ?? 0) > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Measured, not asserted"
        title="Research lab"
        description="Run the same finance questions without context and with grounded context, then inspect every score and claim."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void runsQuery.refetch();
                if (selectedRunId) void detailQuery.refetch();
              }}
              disabled={runsQuery.isFetching}
            >
              <RefreshCw className={cn("size-3.5", runsQuery.isFetching && "animate-spin")} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setRunDialogOpen(true)}
              disabled={!casesQuery.data?.length || Boolean(activeRun)}
            >
              <Play className="size-3.5" />
              Start a run
            </Button>
          </>
        }
      />

      <Card className="relative overflow-hidden border-0 bg-[#071a16] text-white">
        <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-teal-300/[0.06] blur-3xl" />
        <CardContent className="relative grid gap-6 p-6 lg:grid-cols-[1.25fr_1fr] lg:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                rubric-v1
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 text-[9px] font-semibold text-white/70">
                {casesQuery.data?.length ?? "—"} cases · two modes
              </span>
            </div>
            <h2 className="mt-3 max-w-xl text-xl font-semibold tracking-[-0.03em] sm:text-2xl">
              Does context actually improve the answer?
            </h2>
            <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-white/60">
              Grounded mode receives your calculated figures and retrieved references. Baseline
              receives the question alone. A transparent rubric scores both. The lab reports what
              happened, including scores that are flat or worse.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                No fabricated findings
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="size-3.5 text-emerald-400" />
                Every response traceable
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Download className="size-3.5 text-emerald-400" />
                JSON &amp; CSV export
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 self-center">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                Provider
              </p>
              <p className="mt-1 truncate text-[12px] font-semibold">
                {aiQuery.data?.provider ?? "—"}
              </p>
              <p className="mt-0.5 truncate text-[9px] text-white/40">
                {aiQuery.data?.model ?? "Checking status"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                Latest run
              </p>
              <p className="mt-1 text-[12px] font-semibold">
                {runs[0] ? `Run #${runs[0].id}` : "Not run yet"}
              </p>
              <p className="mt-0.5 text-[9px] text-white/40">
                {runs[0] ? formatRelative(runs[0].started_at) : "Start when you are ready"}
              </p>
            </div>
            <div className="col-span-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
              <Activity className="size-3.5 shrink-0 text-emerald-400" />
              <p className="text-[9px] leading-relaxed text-white/55">
                {aiQuery.data?.configured
                  ? "Hosted AI is configured. A full run can be slow and may incur provider cost."
                  : "Deterministic grounded mode is active. No external model calls are needed."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {runsQuery.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-[290px_1fr]">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      ) : runsQuery.isError ? (
        <Card className="py-16 text-center">
          <AlertTriangle className="mx-auto size-6 text-rose-500" />
          <p className="mt-3 text-sm font-semibold">Research runs could not load</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {runsQuery.error instanceof ApiError
              ? runsQuery.error.message
              : "Check the API and try again."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => runsQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : runs.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState
            icon={FlaskConical}
            title="No research runs yet"
            description="Start a run to compare baseline and grounded answers across the configured finance cases. Scores will only appear after the run has actually been evaluated."
            action={{
              label: "Start the first run",
              onClick: () => setRunDialogOpen(true),
            }}
            className="py-16"
          />
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[290px_1fr]">
          <Card className="overflow-hidden lg:sticky lg:top-20">
            <CardHeader className="border-b border-border/60 py-4">
              <div className="flex items-center justify-between">
                <CardTitle>Run history</CardTitle>
                {activeRun && (
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-sky-700">
                    <span className="size-1.5 animate-pulse rounded-full bg-sky-500" />
                    Active
                  </span>
                )}
              </div>
            </CardHeader>
            <div className="max-h-[calc(100vh-14rem)] divide-y divide-border/60 overflow-y-auto">
              {runs.map((run) => {
                const meta = statusMeta[run.status];
                const Icon = meta.icon;
                const active = run.id === selectedRunId;
                return (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => {
                      setSelectedRunId(run.id);
                      setShowFailuresOnly(false);
                    }}
                    className={cn(
                      "w-full px-4 py-3.5 text-left transition-colors",
                      active ? "bg-primary/[0.045]" : "hover:bg-secondary/40",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold">
                        <Icon className={cn("size-3.5", run.status === "failed" && "text-rose-500")} />
                        Run #{run.id}
                      </span>
                      <span className={cn("size-1.5 rounded-full", meta.dot)} />
                    </div>
                    <p className="mt-1 text-[9px] text-muted-foreground">
                      {run.total_cases} cases · {run.response_count} answers
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-[9px] text-muted-foreground/80">
                        <Clock3 className="size-2.5" />
                        {formatRelative(run.started_at)}
                      </span>
                      <span className="text-[9px] font-semibold capitalize text-muted-foreground">
                        {meta.label}
                      </span>
                    </div>
                    {run.summary?.modes.grounded?.averages?.total_score != null && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${((run.summary.modes.grounded.averages.total_score ?? 0) / 5) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[9px] font-semibold tabular text-emerald-700">
                          {run.summary.modes.grounded.averages.total_score.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="min-w-0 space-y-4">
            {selectedRun && detailQuery.isLoading ? (
              <Skeleton className="h-[480px] rounded-2xl" />
            ) : selectedRun && detailQuery.isError ? (
              <Card className="py-16 text-center">
                <AlertTriangle className="mx-auto size-6 text-rose-500" />
                <p className="mt-3 text-sm font-semibold">Run details could not load</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {detailQuery.error instanceof ApiError
                    ? detailQuery.error.message
                    : "Please try again."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => detailQuery.refetch()}
                >
                  Retry
                </Button>
              </Card>
            ) : selectedRun ? (
              <>
                <Card>
                  <CardHeader className="flex-col gap-3 border-b border-border/60 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>Run #{selectedRun.id}</CardTitle>
                        <StatusBadge status={selectedRun.status} />
                        {selectedStatus?.label === "Running" && (
                          <span className="text-[9px] text-muted-foreground">auto-refreshing</span>
                        )}
                      </div>
                      <CardDescription className="mt-1">
                        {selectedRun.provider} · {selectedRun.model_id} ·{" "}
                        {selectedRun.prompt_version} · {selectedRun.rubric_version}
                      </CardDescription>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Started {formatDate(selectedRun.started_at, "d MMM yyyy, HH:mm")}
                        {selectedRun.finished_at &&
                          ` · Finished ${formatDate(selectedRun.finished_at, "d MMM yyyy, HH:mm")}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        onClick={() => exportRun("json")}
                        disabled={!hasResponses || isActive || exporting !== null}
                      >
                        {exporting === "json" ? (
                          <Spin />
                        ) : (
                          <FileJson className="size-3" />
                        )}
                        JSON
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px]"
                        onClick={() => exportRun("csv")}
                        disabled={!hasResponses || isActive || exporting !== null}
                      >
                        {exporting === "csv" ? (
                          <Spin />
                        ) : (
                          <FileSpreadsheet className="size-3" />
                        )}
                        CSV
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-rose-600 hover:bg-rose-50"
                        onClick={() => setDeleteTarget(selectedRun)}
                        disabled={isActive}
                        aria-label="Delete research run"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardHeader>

                  {selectedRun.status === "failed" ? (
                    <CardContent className="space-y-3 py-5">
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-800">
                          <XCircle className="size-3.5" />
                          This run did not finish
                        </p>
                        <p className="mt-1 text-[10px] leading-relaxed text-rose-900/75">
                          {selectedRun.error ?? "The provider or evaluator returned an error."}
                        </p>
                      </div>
                      {hasResponses && (
                        <p className="text-[10px] leading-relaxed text-muted-foreground">
                          Partial responses below were evaluated before the failure. They are
                          reported without filling in missing scores.
                        </p>
                      )}
                    </CardContent>
                  ) : isActive ? (
                    <CardContent className="space-y-4 py-5">
                      <div className="flex items-start gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600">
                          <Activity className="size-4 animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold">
                            {selectedRun.status === "queued"
                              ? "Waiting for the evaluator"
                              : "Generating and scoring answers"}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                            Each case runs baseline and grounded mode. Evaluation is deterministic;
                            this page polls every two seconds.
                          </p>
                        </div>
                      </div>
                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-[9px] text-muted-foreground">
                          <span>
                            {completedCount} of {expectedCount || "—"} answers saved
                          </span>
                          <span>{percentage(progress)}</span>
                        </div>
                        <Progress value={progress} />
                      </div>
                      <p className="rounded-lg bg-secondary/40 px-3 py-2 text-[9px] leading-relaxed text-muted-foreground">
                        Scores appear only after each answer is actually evaluated. You can leave
                        this page; the run continues on the server.
                      </p>
                    </CardContent>
                  ) : selectedRun.summary && hasResponses ? (
                    <CardContent className="space-y-4 py-5">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-border bg-background/40 p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Baseline mean
                          </p>
                          <p className="mt-1 text-2xl font-semibold tabular text-slate-700">
                            {baselineTotal === null ? "—" : baselineTotal.toFixed(2)}
                            <span className="ml-1 text-[10px] font-medium text-muted-foreground">
                              / 5
                            </span>
                          </p>
                          <p className="mt-1 text-[9px] text-muted-foreground">
                            {averageFor(selectedRun, "baseline", "score_grounding") === 0
                              ? "No personal context by design"
                              : "Question alone"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700/70">
                            Grounded mean
                          </p>
                          <p className="mt-1 text-2xl font-semibold tabular text-emerald-800">
                            {groundedTotal === null ? "—" : groundedTotal.toFixed(2)}
                            <span className="ml-1 text-[10px] font-medium text-emerald-700/60">
                              / 5
                            </span>
                          </p>
                          <p className="mt-1 text-[9px] text-emerald-800/60">
                            Calculated facts + retrieved references
                          </p>
                        </div>
                        <div className="rounded-xl border border-border bg-background/40 p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Grounded minus baseline
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-2xl font-semibold tabular",
                              totalDelta === null
                                ? "text-muted-foreground"
                                : totalDelta > 0
                                  ? "text-emerald-700"
                                  : totalDelta < 0
                                    ? "text-rose-600"
                                    : "text-slate-600",
                            )}
                          >
                            {totalDelta === null
                              ? "—"
                              : `${totalDelta > 0 ? "+" : ""}${totalDelta.toFixed(2)}`}
                          </p>
                          <p className="mt-1 text-[9px] text-muted-foreground">
                            {selectedRun.response_count} answers across{" "}
                            {selectedRun.total_cases} cases
                          </p>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-background/40 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[10px] font-semibold">Rubric breakdown</p>
                          <div className="flex items-center gap-3 text-[8px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <span className="size-1.5 rounded-full bg-slate-400" />
                              Baseline
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Grounded
                            </span>
                          </div>
                        </div>
                        <div className="divide-y divide-border/60">
                          {scoreDimensions.map((dimension) => (
                            <ScoreBar
                              key={dimension.key}
                              label={dimension.label}
                              description={dimension.description}
                              baseline={averageFor(selectedRun, "baseline", dimension.key)}
                              grounded={averageFor(selectedRun, "grounded", dimension.key)}
                              delta={
                                selectedRun.summary?.delta_grounded_minus_baseline?.[
                                  dimension.key
                                ] ?? null
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                        <p className="text-[9px] leading-relaxed text-amber-900/75">
                          {selectedRun.summary.note}
                        </p>
                      </div>
                    </CardContent>
                  ) : (
                    <CardContent className="py-8 text-center text-[11px] text-muted-foreground">
                      No responses were recorded for this run.
                    </CardContent>
                  )}
                </Card>

                {hasResponses && detail && (
                  <Card>
                    <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                      <div>
                        <CardTitle>Case-by-case evidence</CardTitle>
                        <CardDescription>
                          Open any case to inspect both answers, calculated evidence, and retrieval.
                        </CardDescription>
                      </div>
                      <label className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                        <Switch checked={showFailuresOnly} onCheckedChange={setShowFailuresOnly} />
                        Failures only
                      </label>
                    </CardHeader>
                    <CardContent>
                      <RunResults
                        detail={detail}
                        casesById={casesById}
                        showFailuresOnly={showFailuresOnly}
                      />
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-dashed border-border p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold">
                      <BookOpen className="size-3.5 text-primary" />
                      What is assessed
                    </p>
                    <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
                      Factual correctness, relevance, traceable grounding, claim safety, and
                      practical usefulness.
                    </p>
                  </div>
                  <div className="rounded-xl border border-dashed border-border p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold">
                      <Layers className="size-3.5 text-primary" />
                      Baseline by design
                    </p>
                    <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
                      Baseline receives no personal facts or retrieved references, so its grounding
                      score is expected to be zero.
                    </p>
                  </div>
                  <div className="rounded-xl border border-dashed border-border p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold">
                      <ShieldCheck className="size-3.5 text-primary" />
                      Honest reporting
                    </p>
                    <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
                      Automated rubric scores are a signal, not human review. Exports include the
                      notes and limitations.
                    </p>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <RunDialog
        open={runDialogOpen}
        onOpenChange={setRunDialogOpen}
        cases={casesQuery.data ?? []}
        isRunning={Boolean(activeRun)}
        onSubmit={(ids) => createRun.mutate(ids)}
        submitting={createRun.isPending}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this research run?"
        description={
          deleteTarget
            ? `Run #${deleteTarget.id} and all of its evaluated answers will be removed permanently. Exported copies are unaffected.`
            : ""
        }
        confirmLabel="Delete run"
        onConfirm={() => deleteTarget && deleteRun.mutate(deleteTarget.id)}
        loading={deleteRun.isPending}
      />
    </div>
  );
}
