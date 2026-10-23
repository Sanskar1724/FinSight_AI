import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  FlaskConical,
  Fingerprint,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Brand, BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { cn, formatINR } from "@/lib/utils";

const features = [
  {
    icon: BarChart3,
    title: "A dashboard that adds up",
    body: "Income, spending, savings rate, budgets, and goals stay consistent because they share one Decimal-precise engine.",
  },
  {
    icon: Sparkles,
    title: "Answers with evidence",
    body: "Ask about your money in plain English. Every response shows the records and calculations behind it.",
  },
  {
    icon: Target,
    title: "Goals that tell the truth",
    body: "See required monthly savings, projected completion, and an honest early warning when a goal is falling behind.",
  },
  {
    icon: FlaskConical,
    title: "A real research lab",
    body: "Run baseline and grounded answers side by side, score them with a transparent rubric, and export the results.",
  },
  {
    icon: WifiOff,
    title: "Installable, dependable",
    body: "A focused web app that installs on your phone or desktop, with clear offline and error states.",
  },
  {
    icon: ShieldCheck,
    title: "No bank connection",
    body: "FinSight works from records you enter. No bank passwords, no UPI PINs, and no pretend account balance.",
  },
];

const categoryMocks = [
  { name: "Food & Dining", amount: 4050, color: "#f59e0b", share: "32%" },
  { name: "Shopping", amount: 4350, color: "#8b5cf6", share: "35%" },
  { name: "Transport", amount: 1850, color: "#0ea5e9", share: "15%" },
];

function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-tr from-emerald-400/10 via-transparent to-teal-300/10 blur-2xl" />
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#0a211b] p-2 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.65)]">
        <div className="rounded-[18px] bg-[#f7faf8] p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrandMark className="size-7 rounded-lg" />
              <span className="text-[11px] font-bold tracking-tight">Overview</span>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-700">
              Demo preview
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Income", value: 45000, accent: "text-emerald-700" },
              { label: "Spent", value: 36505, accent: "text-foreground" },
              { label: "Net", value: 8495, accent: "text-emerald-700" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200/80 bg-white p-2.5">
                <p className="text-[8px] font-semibold uppercase tracking-wider text-slate-400">
                  {item.label}
                </p>
                <p className={cn("mt-1 truncate text-[11px] font-bold tabular sm:text-xs", item.accent)}>
                  {formatINR(item.value, true)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-xl border border-slate-200/80 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold text-slate-500">Cash flow</p>
                <span className="text-[8px] text-slate-400">Last 6 months</span>
              </div>
              <div className="mt-3 flex h-20 items-end gap-1.5">
                {[42, 59, 39, 67, 52, 74, 48, 62, 57, 79, 64, 84].map((height, index) => (
                  <div key={index} className="flex flex-1 items-end gap-0.5">
                    <span
                      className="w-1/2 rounded-sm bg-emerald-200"
                      style={{ height: `${height * 0.8}px` }}
                    />
                    <span
                      className="w-1/2 rounded-sm bg-emerald-600"
                      style={{ height: `${height * 0.8}px` }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-3 text-[7px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-200" /> Income
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-600" /> Expenses
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white p-3">
              <p className="text-[9px] font-semibold text-slate-500">Top categories</p>
              <div className="mt-2 space-y-2">
                {categoryMocks.map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between text-[8px]">
                      <span className="flex items-center gap-1.5 font-medium text-slate-600">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </span>
                      <span className="font-semibold text-slate-700">
                        {formatINR(item.amount, true)}
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: item.share, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2 rounded-xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50 to-teal-50/50 p-3">
            <div className="flex items-start gap-2">
              <div className="grid size-6 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white">
                <Sparkles className="size-3" />
              </div>
              <div>
                <p className="text-[9px] font-bold text-emerald-950">One thing worth noticing</p>
                <p className="mt-1 text-[8px] leading-relaxed text-emerald-900/70">
                  Shopping is ₹350 over budget. Reducing it by 10% next month would free up ₹435
                  per month.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-7 -left-4 hidden w-[220px] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-lift sm:block">
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-lg bg-[#071a16] text-emerald-300">
            <MessageSquareText className="size-3" />
          </span>
          <p className="text-[9px] font-bold text-slate-700">Grounded answer</p>
          <span className="ml-auto size-1.5 rounded-full bg-emerald-500" />
        </div>
        <p className="mt-2 text-[8px] leading-relaxed text-slate-500">
          “Food &amp; Dining is at 90% of its budget with 9 days left.”
        </p>
        <div className="mt-2 flex gap-1">
          <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[7px] text-slate-400">
            6 records
          </span>
          <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[7px] text-slate-400">
            ₹4,050 spent
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const explore = async () => {
    if (isAuthenticated) {
      navigate("/app");
      return;
    }
    setLoading(true);
    try {
      await demoLogin();
      toast.success("Demo workspace ready");
      navigate("/app");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not open the demo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7faf8]">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-[#f7faf8]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand />
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-muted-foreground md:flex">
            <a href="#product" className="transition-colors hover:text-foreground">
              Product
            </a>
            <a href="#intelligence" className="transition-colors hover:text-foreground">
              AI, grounded
            </a>
            <a href="#privacy" className="transition-colors hover:text-foreground">
              Privacy
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {!isAuthenticated && (
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
            <Button size="sm" onClick={explore} disabled={loading}>
              {loading ? "Preparing…" : isAuthenticated ? "Open dashboard" : "Explore demo"}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-1/2 top-[-280px] h-[620px] w-[900px] -translate-x-1/2 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 surface-grid opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:gap-10 lg:pb-28 lg:pt-24">
            <div className="animate-fade-up">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 shadow-sm">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-600" />
                </span>
                Grounded personal finance for India
              </div>
              <h1 className="mt-6 max-w-[650px] text-balance text-[42px] font-semibold leading-[1.02] tracking-[-0.055em] text-[#0b211b] sm:text-[56px] lg:text-[64px]">
                Make every rupee
                <span className="relative ml-2 inline-block text-emerald-700">
                  make sense.
                  <svg
                    className="absolute -bottom-2 left-0 w-full text-emerald-300/80"
                    viewBox="0 0 260 12"
                    fill="none"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 9C70 3 174 2 258 5"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
              <p className="mt-6 max-w-[520px] text-pretty text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]">
                FinSight turns the transactions you record into clear cash-flow trends, honest
                budgets, goal projections, and answers backed by evidence — not vibes.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={explore} disabled={loading} className="group">
                  {loading ? "Preparing demo…" : "Explore the live demo"}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                {!isAuthenticated && (
                  <Button asChild size="lg" variant="outline">
                    <Link to="/register">Create your workspace</Link>
                  </Button>
                )}
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-medium text-muted-foreground">
                {["No bank credentials", "INR-native", "Works as a PWA"].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-emerald-600" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
            <div className="animate-fade-up [animation-delay:120ms]">
              <ProductPreview />
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-white/60">
          <div className="mx-auto grid max-w-7xl gap-px bg-border/60 sm:grid-cols-3">
            {[
              {
                icon: TrendingUp,
                title: "One source of truth",
                body: "Every total is computed from the same ledger.",
              },
              {
                icon: Fingerprint,
                title: "Built around you",
                body: "Your categories, goals, pace, and context.",
              },
              {
                icon: LockKeyhole,
                title: "No pretend precision",
                body: "Forecast ranges and limitations are shown.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-start gap-3.5 bg-[#f9fbfa] px-6 py-6">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="product" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              The whole picture
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              Built for the questions you actually ask about money.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              Not another wall of charts. Each part of FinSight is designed to answer a specific,
              practical question — and show its work.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-border/80 bg-white p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lift",
                    index === 1 && "sm:col-span-1",
                  )}
                >
                  <div className="mb-5 grid size-10 place-items-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                    <Icon className="size-[18px]" />
                  </div>
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{feature.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                  <span className="pointer-events-none absolute -right-10 -top-10 size-24 rounded-full bg-emerald-100/0 transition-colors group-hover:bg-emerald-100/40" />
                </article>
              );
            })}
          </div>
        </section>

        <section id="intelligence" className="bg-[#071a16] py-24 text-white">
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300/80">
                AI, grounded by construction
              </p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
                Ask in plain English.
                <br />
                Get your own numbers back.
              </h2>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/55">
                FinSight uses deterministic calculations first, then optional language generation.
                The assistant is instructed to answer from your records, cite its evidence, and say
                “I don’t have enough data” when that is the honest answer.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  "Calculated facts, not guessed figures",
                  "Curated knowledge with source attribution",
                  "Clear refusal when the data is missing",
                  "Works without any external AI key",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <span className="grid size-5 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                      <Check className="size-3" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[32px] bg-emerald-400/[0.06] blur-2xl" />
              <div className="relative space-y-3 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4 sm:p-6">
                <div className="ml-auto max-w-[84%] rounded-2xl rounded-tr-md bg-emerald-500 px-4 py-3 text-[13px] leading-relaxed text-emerald-950">
                  Which budgets should I be worried about this month?
                </div>
                <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-white/[0.07] bg-[#03110d]/75 p-4">
                  <div className="flex items-center gap-2">
                    <span className="grid size-5 place-items-center rounded-md bg-emerald-400/15 text-emerald-300">
                      <Sparkles className="size-3" />
                    </span>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      FinSight · grounded
                    </p>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-white/70">
                    Food &amp; Dining is the closest to its limit: ₹4,050 spent against ₹4,500
                    (90%), with 9 days remaining. Shopping has already exceeded budget at ₹4,350
                    of ₹4,000.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {["Budget · Food & Dining", "Budget · Shopping", "Current month"].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[9px] text-white/45"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ml-auto max-w-[84%] rounded-2xl rounded-tr-md bg-emerald-500 px-4 py-3 text-[13px] leading-relaxed text-emerald-950">
                  If I reduce food spending by 10%, what changes over six months?
                </div>
                <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-white/35">
                  <span className="flex gap-1">
                    <span className="size-1 animate-pulse rounded-full bg-emerald-300" />
                    <span className="size-1 animate-pulse rounded-full bg-emerald-300 [animation-delay:150ms]" />
                    <span className="size-1 animate-pulse rounded-full bg-emerald-300 [animation-delay:300ms]" />
                  </span>
                  Reading budgets, transactions, and scenarios…
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="privacy" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="grid overflow-hidden rounded-3xl border border-border bg-white shadow-soft lg:grid-cols-2">
            <div className="p-8 sm:p-12">
              <div className="grid size-11 place-items-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                <ShieldCheck className="size-5" />
              </div>
              <h2 className="mt-6 text-balance text-3xl font-semibold tracking-[-0.04em]">
                Honest about what it is — and what it isn’t.
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
                FinSight is a planning workspace, not a bank feed. You stay in control of what
                enters the ledger. There are no made-up account balances and no hidden financial
                advice.
              </p>
              <div className="mt-7 space-y-4">
                {[
                  {
                    title: "Your session, your data",
                    body: "Records are scoped to your account. Passwords are salted and hashed with PBKDF2-SHA256.",
                  },
                  {
                    title: "No credential harvesting",
                    body: "FinSight never asks for net-banking, card, or UPI credentials.",
                  },
                  {
                    title: "Visible limitations",
                    body: "Forecasts are ranges. Scenario results are hypothetical and labeled as such.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-white">
                      <Check className="size-3" />
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative min-h-[340px] overflow-hidden bg-[#0a211b] p-8 sm:p-12">
              <div className="absolute inset-0 surface-grid opacity-30" />
              <div className="absolute -right-16 -top-16 size-64 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="relative flex h-full flex-col justify-center">
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-6">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <LockKeyhole className="size-4" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
                      Private by design
                    </span>
                  </div>
                  <p className="mt-4 text-[22px] font-medium leading-snug tracking-[-0.025em] text-white">
                    “The most useful financial tool is one that tells you when it doesn’t know.”
                  </p>
                  <p className="mt-4 text-xs leading-relaxed text-white/45">
                    Every answer can be traced to recorded transactions, budget limits, goal
                    contributions, or a named knowledge source.
                  </p>
                  <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-4">
                    <BrandMark className="size-8 rounded-lg" />
                    <div>
                      <p className="text-[11px] font-semibold text-white">FinSight AI</p>
                      <p className="text-[9px] text-white/40">Money, in focus.</p>
                    </div>
                    <span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-300">
                      Evidence attached
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 pb-24 sm:px-8">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-[#071a16] px-6 py-14 text-center sm:px-12 sm:py-16">
            <div className="absolute inset-0 surface-grid opacity-25" />
            <div className="absolute left-1/2 top-0 h-40 w-[500px] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300/80">
                Start with clarity
              </p>
              <h2 className="mx-auto mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                See your money clearly. Then decide what to do next.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/50">
                Explore a complete demo workspace with fictional data, or start your own private
                ledger in under a minute.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="lg" onClick={explore} disabled={loading} variant="secondary">
                  {loading ? "Preparing…" : "Explore the demo"}
                  <ArrowRight className="size-4" />
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/15 bg-white/[0.04] text-white hover:border-white/25 hover:bg-white/[0.08]"
                >
                  <Link to={isAuthenticated ? "/app" : "/register"}>
                    {isAuthenticated ? "Open my workspace" : "Create an account"}
                    <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 bg-white/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Brand />
            <p className="mt-3 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
              A grounded personal finance workspace for Indian users. Demo data is fictional.
              FinSight is not a bank, lender, or investment adviser.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
            <a href="#product" className="hover:text-foreground">
              Product
            </a>
            <a href="#intelligence" className="hover:text-foreground">
              AI
            </a>
            <a href="#privacy" className="hover:text-foreground">
              Privacy
            </a>
            <Link to="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
        <div className="border-t border-border/60 py-4 text-center text-[10px] text-muted-foreground/70">
          © {new Date().getFullYear()} FinSight AI · Built with care for clearer money decisions.
        </div>
      </footer>
    </div>
  );
}
