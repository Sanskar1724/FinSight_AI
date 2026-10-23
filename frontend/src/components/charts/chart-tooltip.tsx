import type { TooltipContentProps } from "recharts";

import { formatINR } from "@/lib/utils";

interface ChartTooltipProps extends Partial<TooltipContentProps<number, string>> {
  valueFormatter?: (value: number, name: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 px-3.5 py-3 shadow-lift backdrop-blur">
      {label && <p className="mb-2 text-xs font-semibold text-foreground">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((item) => {
          const value = Number(item.value ?? 0);
          const name = String(item.name ?? "");
          return (
            <div key={`${name}-${item.dataKey}`} className="flex items-center gap-3 text-xs">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: item.color ?? "#10b981" }}
              />
              <span className="text-muted-foreground">{name}</span>
              <span className="ml-auto font-semibold text-foreground">
                {valueFormatter ? valueFormatter(value, name) : formatINR(value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
