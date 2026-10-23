import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Spin({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />;
}

export function FullPageLoader({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
        <div className="grid size-10 place-items-center rounded-2xl border border-primary/15 bg-primary/5">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
        {label}
      </div>
    </div>
  );
}
