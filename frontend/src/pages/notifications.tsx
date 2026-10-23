import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  BellRing,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  Repeat,
  Settings2,
  ShieldAlert,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { SeverityBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spin } from "@/components/ui/spin";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import type { AppNotification, NotificationList } from "@/lib/types";
import { appHref, cn, formatDate, formatINR, formatRelative } from "@/lib/utils";

const categoryMeta: Record<
  string,
  { label: string; icon: typeof Bell; className: string }
> = {
  app_event: { label: "Workspace", icon: Bell, className: "bg-slate-50 text-slate-600" },
  budget_threshold: { label: "Budget", icon: Wallet, className: "bg-amber-50 text-amber-700" },
  budget_risk: { label: "Budget risk", icon: TrendingUp, className: "bg-orange-50 text-orange-700" },
  unusual_spending: {
    label: "Unusual spend",
    icon: ShieldAlert,
    className: "bg-rose-50 text-rose-700",
  },
  recurring: { label: "Recurring", icon: Repeat, className: "bg-sky-50 text-sky-700" },
  bill_due: { label: "Bill due", icon: CalendarClock, className: "bg-violet-50 text-violet-700" },
  goal_behind: { label: "Goal", icon: Target, className: "bg-emerald-50 text-emerald-700" },
  weekly_summary: { label: "Weekly summary", icon: BarChart3, className: "bg-slate-50 text-slate-600" },
  monthly_summary: { label: "Monthly summary", icon: BarChart3, className: "bg-slate-50 text-slate-600" },
};

const filterCategories = [
  { value: "budget_threshold", label: "Budget thresholds" },
  { value: "budget_risk", label: "Budget risk" },
  { value: "unusual_spending", label: "Unusual spending" },
  { value: "recurring", label: "Recurring payments" },
  { value: "bill_due", label: "Bills due" },
  { value: "goal_behind", label: "Goal pace" },
  { value: "weekly_summary", label: "Weekly summaries" },
  { value: "monthly_summary", label: "Monthly summaries" },
  { value: "app_event", label: "Workspace events" },
];

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [page, setPage] = useState(1);

  const notificationsQuery = useQuery({
    queryKey: ["notifications", { page, category, onlyUnread, includeDismissed }],
    queryFn: () =>
      api.get<NotificationList>(
        `/notifications?page=${page}&page_size=20&only_unread=${onlyUnread}&include_dismissed=${includeDismissed}${
          category ? `&category=${category}` : ""
        }`,
      ),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const readMutation = useMutation({
    mutationFn: ({ id, read }: { id: number; read: boolean }) =>
      api.post<AppNotification>(`/notifications/${id}/${read ? "read" : "unread"}`),
    onSuccess: () => invalidate(),
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not update the notification"),
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      toast.success("Notification dismissed");
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not dismiss the notification"),
  });

  const readAllMutation = useMutation({
    mutationFn: () => api.post<{ message: string }>("/notifications/read-all"),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not mark notifications read"),
  });

  const evaluateMutation = useMutation({
    mutationFn: () =>
      api.post<{ created: number; skipped: number; messages: string[] }>(
        "/notifications/evaluate?force=true",
      ),
    onSuccess: (result) => {
      toast.success(
        result.created
          ? `${result.created} new update${result.created === 1 ? "" : "s"} found`
          : "You're up to date",
      );
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not check for updates"),
  });

  const data = notificationsQuery.data;
  const pages = data?.pages ?? 1;
  const hasFilters = Boolean(category) || onlyUnread || includeDismissed;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Automated observations"
        title="Notifications"
        description="Budget warnings, unusual spending, recurring payments, goal pace, and summaries — generated from your records."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/settings">
                <Settings2 className="size-3.5" />
                Preferences
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => evaluateMutation.mutate()}
              disabled={evaluateMutation.isPending}
            >
              {evaluateMutation.isPending ? <Spin /> : <RefreshCw className="size-3.5" />}
              Check for updates
            </Button>
            <Button
              size="sm"
              onClick={() => readAllMutation.mutate()}
              disabled={!data?.unread || readAllMutation.isPending}
            >
              {readAllMutation.isPending ? <Spin /> : <Check className="size-3.5" />}
              Mark all read
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_270px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border/70 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-1.5 text-[11px] font-semibold text-primary">
                <BellRing className="size-3.5" />
                {data?.unread ?? 0} unread
              </div>
              <Select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setPage(1);
                }}
                className="h-9 w-[190px] text-xs"
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {filterCategories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
              <div className="ml-auto flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                  <Switch
                    checked={onlyUnread}
                    onCheckedChange={(checked) => {
                      setOnlyUnread(checked);
                      setPage(1);
                    }}
                  />
                  Unread only
                </label>
                <label className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                  <Switch
                    checked={includeDismissed}
                    onCheckedChange={(checked) => {
                      setIncludeDismissed(checked);
                      setPage(1);
                    }}
                  />
                  Show dismissed
                </label>
              </div>
            </div>
          </div>

          {notificationsQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : notificationsQuery.isError ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold">Notifications could not load</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {notificationsQuery.error instanceof ApiError
                  ? notificationsQuery.error.message
                  : "Please try again."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => notificationsQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : !data?.items.length ? (
            <EmptyState
              icon={Bell}
              title={hasFilters ? "No matching notifications" : "You're all caught up"}
              description={
                hasFilters
                  ? "Try removing a filter to see more updates."
                  : "When a budget, goal, bill, or spending pattern needs attention, it will appear here."
              }
              action={
                hasFilters
                  ? {
                      label: "Clear filters",
                      onClick: () => {
                        setCategory("");
                        setOnlyUnread(false);
                        setIncludeDismissed(false);
                        setPage(1);
                      },
                    }
                  : undefined
              }
              className="py-16"
            />
          ) : (
            <div className="divide-y divide-border/60">
              {data.items.map((notification) => {
                const meta = categoryMeta[notification.category] ?? categoryMeta.app_event;
                const Icon = meta.icon;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "relative p-4 transition-colors hover:bg-secondary/20 sm:p-5",
                      !notification.is_read && "bg-primary/[0.018]",
                      notification.dismissed_at && "opacity-60",
                    )}
                  >
                    {!notification.is_read && (
                      <span className="absolute left-0 top-0 h-full w-0.5 bg-primary" />
                    )}
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-xl",
                          meta.className,
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={cn(
                              "text-[13px] font-semibold",
                              !notification.is_read && "text-foreground",
                            )}
                          >
                            {notification.title}
                          </p>
                          <SeverityBadge severity={notification.severity} />
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {meta.label}
                          </span>
                          {notification.dismissed_at && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold text-slate-500">
                              Dismissed
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                          {notification.message}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground/80">
                          <span>{formatRelative(notification.created_at)}</span>
                          {notification.amount !== null && (
                            <span className="font-semibold tabular text-foreground/70">
                              {formatINR(notification.amount)}
                            </span>
                          )}
                          {notification.scheduled_for && (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="size-2.5" />
                              Scheduled {formatDate(notification.scheduled_for, "d MMM, HH:mm")}
                            </span>
                          )}
                          {notification.deliveries.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="size-2.5" />
                              {notification.deliveries.length} delivery record
                              {notification.deliveries.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {notification.action_label && (
                            <Button asChild variant="outline" size="sm" className="h-7 text-[10px]">
                              <Link to={appHref(notification.action_url)}>
                                {notification.action_label}
                              </Link>
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              readMutation.mutate({
                                id: notification.id,
                                read: !notification.is_read,
                              })
                            }
                            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground"
                          >
                            Mark as {notification.is_read ? "unread" : "read"}
                          </button>
                          {!notification.dismissed_at && (
                            <button
                              type="button"
                              onClick={() => dismissMutation.mutate(notification.id)}
                              className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-rose-600"
                            >
                              <X className="size-3" />
                              Dismiss
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {data && data.items.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/70 px-4 py-3">
              <p className="text-[10px] text-muted-foreground">
                {data.total} notification{data.total === 1 ? "" : "s"}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-1 text-[10px] text-muted-foreground">
                  {page} / {pages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page >= pages}
                  onClick={() => setPage((value) => value + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/5 text-primary">
              <BellRing className="size-4" />
            </div>
            <h3 className="mt-3 text-sm font-semibold">How updates work</h3>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              FinSight evaluates deterministic rules when your records change, plus on a periodic
              schedule. Duplicate alerts are suppressed per budget month, bill, goal, or week.
            </p>
            <Link
              to="/app/settings"
              className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
            >
              Tune notification preferences
              <ChevronRight className="size-3" />
            </Link>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold">Quiet hours</h3>
            <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
              Summary notifications can be held during your quiet window. Time-sensitive budget
              and unusual-spending alerts still appear in the app.
            </p>
            <div className="mt-3 rounded-lg bg-secondary/50 px-3 py-2 text-[10px] text-muted-foreground">
              Manage timing and alert thresholds in Settings → Notifications.
            </div>
          </Card>

          <div className="rounded-xl border border-dashed border-border p-4 text-center">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Email delivery is not configured. Notifications live inside your FinSight workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
