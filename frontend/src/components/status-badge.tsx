import { AlertTriangle, CheckCircle2, CircleDashed, Flame, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { BudgetStatus, GoalStatus, Severity } from "@/lib/types";

const budgetMap: Record<
  BudgetStatus,
  { label: string; variant: "success" | "warning" | "danger" | "neutral"; icon: typeof CheckCircle2 }
> = {
  healthy: { label: "Healthy", variant: "success", icon: CheckCircle2 },
  approaching: { label: "Approaching", variant: "warning", icon: AlertTriangle },
  critical: { label: "Critical", variant: "danger", icon: Flame },
  exceeded: { label: "Exceeded", variant: "danger", icon: Flame },
};

const goalMap: Record<
  GoalStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  on_track: { label: "On track", variant: "success" },
  behind: { label: "Behind", variant: "warning" },
  at_risk: { label: "At risk", variant: "danger" },
  achieved: { label: "Achieved", variant: "info" },
  no_date: { label: "No target date", variant: "neutral" },
};

const severityMap: Record<Severity, { label: string; variant: "info" | "warning" | "danger" }> = {
  info: { label: "Info", variant: "info" },
  warning: { label: "Warning", variant: "warning" },
  critical: { label: "Critical", variant: "danger" },
};

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const config = budgetMap[status];
  const Icon = config.icon;
  return (
    <Badge variant={config.variant}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  const config = goalMap[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const config = severityMap[severity];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function PrivacyBadge() {
  return (
    <Badge variant="neutral">
      <ShieldCheck className="size-3" />
      Private by design
    </Badge>
  );
}

export function PendingBadge() {
  return (
    <Badge variant="neutral">
      <CircleDashed className="size-3" />
      Not evaluated yet
    </Badge>
  );
}
