import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  change?: number | null;
  inverseChange?: boolean;
  accent?: "emerald" | "amber" | "sky" | "violet";
  loading?: boolean;
}

const accents = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  sky: "bg-sky-50 text-sky-700 border-sky-100",
  violet: "bg-violet-50 text-violet-700 border-violet-100",
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  change,
  inverseChange,
  accent = "emerald",
  loading,
}: MetricCardProps) {
  const isFlat = change === null || change === undefined || Math.abs(change) < 0.05;
  const isGood = isFlat ? null : inverseChange ? change < 0 : change > 0;
  const ChangeIcon = isFlat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground sm:text-[11px]">
          {label}
        </p>
        <span
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-lg border sm:size-8",
            accents[accent],
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>
      {loading ? (
        <div className="mt-4 h-8 w-32 animate-pulse rounded-lg bg-secondary" />
      ) : (
        <p className="mt-2 truncate text-xl font-semibold tracking-[-0.035em] tabular sm:text-[26px]">
          {value}
        </p>
      )}
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {!isFlat && change !== null && change !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold",
              isGood ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600",
            )}
          >
            <ChangeIcon className="size-3" />
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        <p className="truncate text-[10px] text-muted-foreground">{hint}</p>
      </div>
    </Card>
  );
}
