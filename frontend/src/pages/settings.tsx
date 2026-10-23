import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CalendarClock,
  Check,
  CircleCheck,
  Download,
  Info,
  LockKeyhole,
  LogOut,
  Mail,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { BillDialog } from "@/components/bill-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Spin } from "@/components/ui/spin";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { api, ApiError, downloadBlob } from "@/lib/api";
import type { Bill, NotificationPreferences } from "@/lib/types";
import { cn, formatDate, formatINR, todayISO } from "@/lib/utils";

const preferenceGroups = [
  {
    title: "Spending & budgets",
    items: [
      {
        key: "budget_warning_enabled" as const,
        title: "Budget threshold alerts",
        description: "Warn when a category crosses its warning or critical threshold.",
      },
      {
        key: "unusual_spending_enabled" as const,
        title: "Unusual spending indicators",
        description: "Flag statistical outliers relative to similar purchases.",
      },
      {
        key: "recurring_enabled" as const,
        title: "Recurring payment detection",
        description: "Surface regular payments that may be worth reviewing.",
      },
    ],
  },
  {
    title: "Commitments & reviews",
    items: [
      {
        key: "bill_reminders_enabled" as const,
        title: "Bill reminders",
        description: "Remind you before a tracked bill is due.",
      },
      {
        key: "goal_enabled" as const,
        title: "Goal pace alerts",
        description: "Notify when a dated savings goal falls behind.",
      },
      {
        key: "weekly_summary_enabled" as const,
        title: "Weekly summary",
        description: "A short recap of the week's recorded activity.",
      },
      {
        key: "monthly_summary_enabled" as const,
        title: "Monthly summary",
        description: "A recap after each complete month.",
      },
    ],
  },
];

export default function SettingsPage() {
  const { user, logout, resetDemo } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsError, setPrefsError] = useState("");
  const [billOpen, setBillOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const prefsQuery = useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () => api.get<NotificationPreferences>("/notifications/preferences"),
  });

  const billsQuery = useQuery({
    queryKey: ["bills"],
    queryFn: () => api.get<Bill[]>("/bills"),
  });

  useEffect(() => {
    if (prefsQuery.data) setPrefs(prefsQuery.data);
  }, [prefsQuery.data]);

  const savePrefs = useMutation({
    mutationFn: (payload: NotificationPreferences) =>
      api.put<NotificationPreferences>("/notifications/preferences", payload),
    onSuccess: (data) => {
      setPrefs(data);
      setPrefsError("");
      toast.success("Notification preferences saved");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : "Could not save your preferences";
      setPrefsError(message);
      toast.error(message);
    },
  });

  const billPaidMutation = useMutation({
    mutationFn: ({ id, paid }: { id: number; paid: boolean }) =>
      api.patch<Bill>(`/bills/${id}`, { is_paid: paid }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not update the bill"),
  });

  const deleteBillMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/bills/${id}`),
    onSuccess: () => {
      toast.success("Bill reminder deleted");
      setDeletingBill(null);
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not delete the bill"),
  });

  const changePref = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => {
    setPrefs((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = () => {
    if (!prefs) return;
    if (prefs.critical_threshold <= prefs.warning_threshold) {
      setPrefsError("Critical threshold must be greater than warning threshold");
      return;
    }
    setPrefsError("");
    savePrefs.mutate(prefs);
  };

  const signOut = async () => {
    await logout();
    toast.success("Signed out securely");
    navigate("/");
  };

  const reset = async () => {
    setResetting(true);
    try {
      await resetDemo();
      setResetOpen(false);
      toast.success("Demo workspace reset to its original fictional data");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not reset the demo");
    } finally {
      setResetting(false);
    }
  };

  const downloadLedger = async () => {
    setDownloading(true);
    try {
      await downloadBlob("/transactions/export", `finsight-transactions-${todayISO()}.csv`);
      toast.success("Transaction CSV downloaded");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const bills = billsQuery.data ?? [];
  const unpaid = bills.filter((bill) => !bill.is_paid);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Your workspace"
        title="Settings"
        description="Account details, notification rules, bill reminders, and the controls you need to leave cleanly."
      />

      <Tabs defaultValue="notifications">
        <TabsList className="h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto">
          <TabsTrigger value="notifications">
            <Bell className="mr-1.5 size-3.5" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="bills">
            <ReceiptText className="mr-1.5 size-3.5" />
            Bills
          </TabsTrigger>
          <TabsTrigger value="account">
            <UserRound className="mr-1.5 size-3.5" />
            Account &amp; privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          {prefsQuery.isLoading || !prefs ? (
            prefsQuery.isError ? (
              <Card className="py-12 text-center">
                <p className="text-sm font-semibold">Preferences could not load</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => prefsQuery.refetch()}>
                  Retry
                </Button>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Skeleton className="h-80 rounded-2xl" />
                <Skeleton className="h-80 rounded-2xl" />
              </div>
            )
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div className="space-y-4">
                {preferenceGroups.map((group) => (
                  <Card key={group.title}>
                    <CardHeader>
                      <CardTitle>{group.title}</CardTitle>
                      <CardDescription>Choose which observations reach your inbox.</CardDescription>
                    </CardHeader>
                    <CardContent className="divide-y divide-border/60">
                      {group.items.map((item) => (
                        <div
                          key={item.key}
                          className="flex items-center justify-between gap-5 py-3.5 first:pt-0 last:pb-0"
                        >
                          <div>
                            <p className="text-xs font-semibold">{item.title}</p>
                            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <Switch
                            checked={prefs[item.key]}
                            onCheckedChange={(value) => changePref(item.key, value)}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}

                <Card>
                  <CardHeader>
                    <CardTitle>Delivery</CardTitle>
                    <CardDescription>Where notifications can reach you.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold">In-app notification center</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          Always available inside FinSight.
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">
                        <Check className="size-3" /> Active
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
                      <div>
                        <p className="text-xs font-semibold">Email delivery</p>
                        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                          No email provider is configured in this deployment, so this setting has
                          no delivery effect.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail className="size-3.5 text-muted-foreground/50" />
                        <Switch checked={false} disabled />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-center justify-between gap-3">
                  {prefsError ? (
                    <p className="text-[11px] font-medium text-rose-600">{prefsError}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">
                      Changes apply to future notification evaluations.
                    </p>
                  )}
                  <Button onClick={save} disabled={savePrefs.isPending}>
                    {savePrefs.isPending && <Spin />}
                    Save preferences
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Thresholds</CardTitle>
                    <CardDescription>When budget alerts begin.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="warning-threshold">Warning at (%)</Label>
                      <Input
                        id="warning-threshold"
                        type="number"
                        min={1}
                        max={99}
                        value={prefs.warning_threshold}
                        onChange={(event) =>
                          changePref("warning_threshold", Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="critical-threshold">Critical at (%)</Label>
                      <Input
                        id="critical-threshold"
                        type="number"
                        min={2}
                        max={100}
                        value={prefs.critical_threshold}
                        onChange={(event) =>
                          changePref("critical_threshold", Number(event.target.value))
                        }
                      />
                    </div>
                    <div className="rounded-lg bg-secondary/50 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                      Critical must be greater than warning. Individual budgets can override the
                      defaults.
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quiet hours</CardTitle>
                    <CardDescription>Hold summary notifications overnight.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold">Enable quiet hours</p>
                      <Switch
                        checked={prefs.quiet_hours_enabled}
                        onCheckedChange={(value) => changePref("quiet_hours_enabled", value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="quiet-start">Start</Label>
                        <Input
                          id="quiet-start"
                          type="time"
                          value={prefs.quiet_start}
                          disabled={!prefs.quiet_hours_enabled}
                          onChange={(event) => changePref("quiet_start", event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="quiet-end">End</Label>
                        <Input
                          id="quiet-end"
                          type="time"
                          value={prefs.quiet_end}
                          disabled={!prefs.quiet_hours_enabled}
                          onChange={(event) => changePref("quiet_end", event.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-[9px] leading-relaxed text-muted-foreground">
                      Time-sensitive in-app alerts are not suppressed; quiet hours delay summary
                      notifications.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bills" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Bills &amp; reminders</CardTitle>
                <CardDescription>
                  {unpaid.length
                    ? `${unpaid.length} unpaid bill${unpaid.length === 1 ? "" : "s"} tracked.`
                    : "Track recurring bills so due-date reminders can reach you."}
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingBill(null);
                  setBillOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add bill
              </Button>
            </CardHeader>
            <CardContent>
              {billsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : billsQuery.isError ? (
                <div className="py-8 text-center">
                  <p className="text-sm font-semibold">Bills could not load</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => billsQuery.refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : bills.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  title="No bill reminders yet"
                  description="Add rent, utilities, subscriptions, or any dated commitment. FinSight will remind you before it is due."
                  action={{
                    label: "Add your first bill",
                    onClick: () => {
                      setEditingBill(null);
                      setBillOpen(true);
                    },
                  }}
                  className="py-10"
                />
              ) : (
                <div className="divide-y divide-border/60">
                  {bills.map((bill) => {
                    const days = Math.ceil(
                      (new Date(`${bill.due_date}T23:59:59`).getTime() - Date.now()) / 86_400_000,
                    );
                    const overdue = !bill.is_paid && days < 0;
                    const dueSoon = !bill.is_paid && days >= 0 && days <= 7;
                    return (
                      <div key={bill.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          onClick={() =>
                            billPaidMutation.mutate({ id: bill.id, paid: !bill.is_paid })
                          }
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-full border transition-colors",
                            bill.is_paid
                              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                              : "border-border bg-card text-muted-foreground hover:border-primary/30",
                          )}
                          aria-label={bill.is_paid ? "Mark unpaid" : "Mark paid"}
                        >
                          {bill.is_paid ? (
                            <CircleCheck className="size-4" />
                          ) : (
                            <Wallet className="size-3.5" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "truncate text-xs font-semibold",
                              bill.is_paid && "text-muted-foreground line-through",
                            )}
                          >
                            {bill.name}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span>Due {formatDate(bill.due_date)}</span>
                            {overdue && (
                              <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[8px] font-semibold text-rose-700">
                                Overdue
                              </span>
                            )}
                            {dueSoon && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[8px] font-semibold text-amber-700">
                                Due soon
                              </span>
                            )}
                            {bill.is_paid && (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-700">
                                Paid
                              </span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs font-semibold tabular">{formatINR(bill.amount)}</p>
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditingBill(bill);
                              setBillOpen(true);
                            }}
                            aria-label={`Edit ${bill.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-rose-600 hover:bg-rose-50"
                            onClick={() => setDeletingBill(bill)}
                            aria-label={`Delete ${bill.name}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card/60 px-4 py-3">
            <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Bills are reminders, not payments. FinSight cannot see whether a bill was paid outside
              the app, so mark it paid to stop reminders.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Your workspace identity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl bg-[#071a16] text-sm font-bold text-emerald-300">
                    {user?.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{user?.name}</p>
                    <p className="text-[11px] text-muted-foreground">{user?.email}</p>
                  </div>
                  {user?.is_demo && (
                    <span className="ml-auto rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                      Demo
                    </span>
                  )}
                </div>
                <dl className="space-y-2 border-t border-border/60 pt-4 text-[11px]">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Time zone</dt>
                    <dd className="font-medium">{user?.timezone}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Member since</dt>
                    <dd className="font-medium">
                      {user?.created_at ? formatDate(user.created_at) : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Account type</dt>
                    <dd className="font-medium">
                      {user?.is_demo ? "Fictional demonstration" : "Personal workspace"}
                    </dd>
                  </div>
                </dl>
                <div className="flex gap-2 border-t border-border/60 pt-4">
                  <Button variant="outline" size="sm" onClick={signOut}>
                    <LogOut className="size-3.5" />
                    Sign out
                  </Button>
                  {user?.is_demo && (
                    <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
                      <RotateCcw className="size-3.5" />
                      Reset demo data
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your data</CardTitle>
                <CardDescription>Take it with you, or understand where it lives.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary">
                    <Download className="size-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold">Export transactions</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                      Download every transaction as a UTF-8 CSV with spreadsheet-safe fields.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 text-[10px]"
                      onClick={downloadLedger}
                      disabled={downloading}
                    >
                      {downloading ? <Spin /> : <Download className="size-3" />}
                      Download CSV
                    </Button>
                  </div>
                </div>
                <div className="border-t border-border/60 pt-4">
                  <p className="text-xs font-semibold">What FinSight stores</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    The transactions you enter, categories, budgets, goals, contributions, bill
                    reminders, notification preferences and messages, AI conversation history, and
                    research runs you create. No bank connection or account balance exists.
                  </p>
                </div>
                <div className="border-t border-border/60 pt-4">
                  <p className="text-xs font-semibold">Local-first by default</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    This deployment uses a SQLite database on the server. If you configure a
                    hosted AI provider, only the calculated context needed for an answer is sent to
                    that provider.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <CardTitle>Privacy &amp; limitations</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: LockKeyhole,
                  title: "No credential access",
                  body: "FinSight never asks for net-banking, card, or UPI credentials.",
                },
                {
                  icon: Info,
                  title: "No regulated advice",
                  body: "Content is educational and analytical, not investment or tax advice.",
                },
                {
                  icon: RotateCcw,
                  title: "No fake corrections",
                  body: "Edits recalculate the same deterministic ledger; history is not silently rewritten.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex gap-2.5">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <div>
                      <p className="text-[11px] font-semibold">{item.title}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BillDialog
        open={billOpen}
        onOpenChange={(open) => {
          setBillOpen(open);
          if (!open) setEditingBill(null);
        }}
        bill={editingBill}
      />
      <ConfirmDialog
        open={Boolean(deletingBill)}
        onOpenChange={(open) => !open && setDeletingBill(null)}
        title="Delete this bill reminder?"
        description={deletingBill ? `“${deletingBill.name}” will be removed permanently.` : ""}
        confirmLabel="Delete bill"
        onConfirm={() => deletingBill && deleteBillMutation.mutate(deletingBill.id)}
        loading={deleteBillMutation.isPending}
      />
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset the demo workspace?"
        description="All fictional demo transactions, budgets, goals, conversations, and research runs will be replaced with the original seeded demo data. This cannot be undone."
        confirmLabel="Reset demo data"
        onConfirm={reset}
        loading={resetting}
      />
    </div>
  );
}
