import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, LogOut, Menu, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Brand } from "@/components/brand";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useCommandPaletteShortcut } from "@/hooks/use-command-palette-shortcut";
import { api } from "@/lib/api";
import { navigation } from "@/lib/navigation";
import { cn, initials } from "@/lib/utils";

const titles: Record<string, string> = {
  "/app": "Overview",
  "/app/transactions": "Transactions",
  "/app/budgets": "Budgets",
  "/app/goals": "Goals",
  "/app/analytics": "Analytics",
  "/app/scenarios": "Scenario lab",
  "/app/assistant": "AI assistant",
  "/app/notifications": "Notifications",
  "/app/research": "Research lab",
  "/app/settings": "Settings",
};

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<{ unread: number }>("/notifications/unread-count"),
    staleTime: 20_000,
  });

  const signOut = async () => {
    await logout();
    toast.success("Signed out securely");
    navigate("/");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-6 pt-6">
        <Brand to="/app" inverted />
      </div>

      <nav className="scrollbar-none flex-1 space-y-7 overflow-y-auto px-3">
        {navigation.map((group) => (
          <div key={group.label}>
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-muted/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const badge =
                  item.to === "/app/notifications" && unread.data?.unread
                    ? unread.data.unread
                    : null;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={"end" in item ? item.end : false}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all",
                        isActive
                          ? "bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                          : "text-sidebar-muted hover:bg-white/[0.05] hover:text-white",
                      )
                    }
                  >
                    <Icon className="size-[17px] opacity-90" />
                    <span className="flex-1">{item.label}</span>
                    {badge ? (
                      <span className="grid min-w-5 place-items-center rounded-full bg-emerald-400 px-1.5 py-0.5 text-[10px] font-bold text-emerald-950">
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : (
                      <ChevronRight className="size-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-40" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-2xl border border-white/[0.08] bg-white/[0.045] p-3.5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-xs font-bold text-emerald-300">
            {initials(user?.name ?? "Guest")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{user?.name}</p>
            <p className="truncate text-[10px] text-sidebar-muted">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-lg p-2 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        {user?.is_demo && (
          <p className="mt-3 border-t border-white/[0.07] pt-2.5 text-[10px] leading-relaxed text-sidebar-muted">
            Fictional demo account. Reset it any time from Settings.
          </p>
        )}
      </div>
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useCommandPaletteShortcut(setPaletteOpen);
  const { user } = useAuth();
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api.get<{ unread: number }>("/notifications/unread-count"),
    staleTime: 20_000,
  });

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  const title = titles[location.pathname] ?? "FinSight";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] overflow-hidden bg-sidebar lg:block">
        <div className="pointer-events-none absolute -left-24 top-1/3 size-64 rounded-full bg-emerald-500/[0.06] blur-3xl" />
        <div className="relative h-full">
          <SidebarContent />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[#03110d]/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          />
          <aside className="relative h-full w-[280px] max-w-[86vw] animate-fade-in overflow-hidden bg-sidebar shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid size-9 place-items-center rounded-xl border border-border bg-card text-foreground shadow-sm lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </button>
          <div className="lg:hidden">
            <Brand to="/app" compact />
          </div>
          <div className="hidden min-w-0 items-baseline gap-3 lg:flex">
            <p className="text-sm font-semibold">{title}</p>
            {user?.is_demo && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Demo data
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="group hidden h-9 w-56 items-center gap-2 rounded-xl border border-border bg-card px-3 text-left text-xs text-muted-foreground shadow-sm transition-colors hover:border-primary/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:flex xl:w-72"
              aria-label="Search or jump to (Ctrl+K)"
            >
              <Search className="size-3.5" />
              <span className="flex-1 truncate">Search or jump to…</span>
              <kbd className="rounded-md border border-border bg-secondary px-1.5 py-0.5 font-sans text-[10px] font-semibold">
                Ctrl K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground md:hidden"
              aria-label="Search or jump to"
            >
              <Search className="size-4" />
            </button>
            <Link
              to="/app/notifications"
              className="relative grid size-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-primary/25 hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              {Boolean(unread.data?.unread) && (
                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-rose-500" />
              )}
            </Link>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link to="/app/transactions?new=1">
                <Plus className="size-4" />
                Add transaction
              </Link>
            </Button>
            <Button asChild size="icon-sm" className="sm:hidden" aria-label="Add transaction">
              <Link to="/app/transactions?new=1">
                <Plus className="size-4" />
              </Link>
            </Button>
          </div>
        </header>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <main className="page-container min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
        <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 pb-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>FinSight is a planning tool, not a bank or financial adviser.</p>
          <p className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Your records stay in your own FinSight workspace
          </p>
        </footer>
      </div>
    </div>
  );
}
