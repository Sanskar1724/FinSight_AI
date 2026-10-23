import { ArrowLeft, Compass, LayoutDashboard, SearchX } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function NotFoundPage() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const insideApp = location.pathname.startsWith("/app");

  const content = (
    <div className="mx-auto w-full max-w-lg text-center">
      <div className="relative mx-auto grid size-24 place-items-center">
        <div className="absolute inset-0 rounded-full bg-primary/[0.06]" />
        <div className="absolute inset-3 rounded-full border border-dashed border-primary/20" />
        <SearchX className="relative size-7 text-primary" />
        <span className="absolute -right-1 top-2 rounded-full border border-border bg-card px-2 py-0.5 text-[9px] font-bold text-muted-foreground shadow-sm">
          404
        </span>
      </div>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
        Off the map
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
        This page is not part of your money map.
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        The address <span className="break-all font-medium text-foreground/80">{location.pathname}</span>{" "}
        does not exist, may have moved, or belongs to something that was removed.
      </p>
      <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
        <Button asChild size="lg">
          <Link to={isAuthenticated ? "/app" : "/"}>
            {isAuthenticated ? <LayoutDashboard className="size-4" /> : <ArrowLeft className="size-4" />}
            {isAuthenticated ? "Back to overview" : "Back to home"}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to={isAuthenticated ? "/app/transactions" : "/login"}>
            <Compass className="size-4" />
            {isAuthenticated ? "Go to transactions" : "Sign in"}
          </Link>
        </Button>
      </div>
    </div>
  );

  if (insideApp) {
    return <div className="grid min-h-[calc(100vh-13rem)] place-items-center py-10">{content}</div>;
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      <div className="surface-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -left-32 top-1/4 size-96 rounded-full bg-emerald-400/[0.07] blur-3xl" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Brand to="/" />
        <Button asChild variant="ghost" size="sm">
          <Link to={isAuthenticated ? "/app" : "/"}>FinSight home</Link>
        </Button>
      </header>
      <div className="relative grid flex-1 place-items-center px-5 py-10 sm:px-8">{content}</div>
      <footer className="relative px-5 py-6 text-center text-[10px] text-muted-foreground sm:px-8">
        FinSight is a planning tool, not a bank or financial adviser.
      </footer>
    </main>
  );
}
