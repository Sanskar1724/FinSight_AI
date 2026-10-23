import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-9 place-items-center overflow-hidden rounded-xl bg-[#0b2e26] text-white shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-5" fill="none">
        <path
          d="M5 23.5 11.5 16l4.6 4.2L25.5 8"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="25.5" cy="8" r="2.4" fill="#34d399" />
      </svg>
      <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
    </span>
  );
}

interface BrandProps {
  to?: string;
  compact?: boolean;
  inverted?: boolean;
  className?: string;
}

export function Brand({ to = "/", compact = false, inverted = false, className }: BrandProps) {
  return (
    <Link
      to={to}
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="FinSight AI home"
    >
      <BrandMark />
      {!compact && (
        <span className="leading-none">
          <span
            className={cn(
              "block text-[15px] font-bold tracking-[-0.03em]",
              inverted ? "text-white" : "text-foreground",
            )}
          >
            FinSight<span className="text-emerald-400">.</span>AI
          </span>
          <span
            className={cn(
              "mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em]",
              inverted ? "text-white/45" : "text-muted-foreground",
            )}
          >
            Money, in focus
          </span>
        </span>
      )}
    </Link>
  );
}
