import { ArrowUpRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import type { PropsWithChildren } from "react";
import { Link } from "react-router-dom";

import { Brand } from "@/components/brand";

const highlights = [
  "See where your money actually goes",
  "Ask questions grounded in your own records",
  "Plan goals and scenarios without guesswork",
];

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[1fr_0.95fr]">
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 sm:px-10">
          <Brand />
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to home
            <ArrowUpRight className="size-3.5" />
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-5 py-8 sm:px-10">
          <div className="w-full max-w-[420px] animate-fade-up">{children}</div>
        </div>
        <footer className="px-6 pb-6 text-center text-[11px] text-muted-foreground sm:px-10">
          Fictional demo data. No bank connection required.
        </footer>
      </div>

      <aside className="relative hidden overflow-hidden bg-[#061713] lg:block">
        <div className="absolute inset-0 surface-grid opacity-40" />
        <div className="absolute -right-32 -top-32 size-[420px] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-[340px] rounded-full bg-teal-400/[0.07] blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
            <ShieldCheck className="size-4" />
            Private by design
          </div>

          <div className="max-w-lg">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-white/60">
              <Sparkles className="size-3.5 text-emerald-300" />
              Grounded financial intelligence
            </p>
            <h2 className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-white xl:text-[46px]">
              A clearer view of your money, without the noise.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/55">
              Record what happened. FinSight turns it into context, trends, and answers you can
              trace back to real numbers.
            </p>
            <ul className="mt-8 space-y-3.5">
              {highlights.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/75">
                  <span className="grid size-5 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                    <Check className="size-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                  Illustrative preview
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  “Which of my budgets are at risk of going over?”
                </p>
              </div>
              <span className="rounded-lg bg-emerald-400/10 p-2 text-emerald-300">
                <Sparkles className="size-4" />
              </span>
            </div>
            <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#03110d]/60 p-3.5">
              <p className="text-xs leading-relaxed text-white/60">
                Food &amp; Dining is at 90% of its limit with 9 days left. At the current pace,
                projected spend is ₹4,750 against a ₹4,500 limit.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md border border-white/10 px-2 py-0.5 text-[9px] font-medium text-white/40">
                  Budget · Food &amp; Dining
                </span>
                <span className="rounded-md border border-white/10 px-2 py-0.5 text-[9px] font-medium text-white/40">
                  Projection · 30 days
                </span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
