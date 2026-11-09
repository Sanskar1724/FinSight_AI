import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Archive, ArchiveRestore, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AccountDialog, TransferDialog } from "@/components/account-dialogs";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useUrlAction } from "@/hooks/use-url-action";
import { accountKind, accountLabel } from "@/lib/accounts";
import { api, ApiError } from "@/lib/api";
import type { Account, AccountList, AccountTransfer } from "@/lib/types";
import { cn, formatDate, formatINR } from "@/lib/utils";

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<AccountList>("/accounts"),
  });
  const transfersQuery = useQuery({
    queryKey: ["transfers"],
    queryFn: () => api.get<AccountTransfer[]>("/accounts/transfers"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["transfers"] });
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const archiveMutation = useMutation({
    mutationFn: (account: Account) =>
      api.patch<Account>(`/accounts/${account.id}`, { is_archived: !account.is_archived }),
    onSuccess: (account) => {
      toast.success(account.is_archived ? "Account archived" : "Account restored");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not update the account"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/accounts/${id}`),
    onSuccess: () => {
      toast.success("Account deleted. Its transactions were kept.");
      setDeleting(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not delete the account"),
  });

  const deleteTransferMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/accounts/transfers/${id}`),
    onSuccess: () => {
      toast.success("Transfer removed");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Could not remove the transfer"),
  });

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  useUrlAction("new", openCreate);

  const data = accountsQuery.data;
  const accounts = data?.accounts ?? [];
  const names = new Map(accounts.map((account) => [account.id, accountLabel(account)]));
  const transfers = transfersQuery.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Where your money sits"
        title="Accounts"
        description="Bank accounts, cards, wallets and cash in one place. Balances are worked out from your opening balance and linked transactions, so they always match the ledger."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
              <ArrowLeftRight className="size-4" />
              Transfer
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add account
            </Button>
          </div>
        }
      />

      {accountsQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-48 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : accountsQuery.isError ? (
        <Card className="py-16 text-center">
          <p className="text-sm font-semibold">Accounts could not load</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {accountsQuery.error instanceof ApiError ? accountsQuery.error.message : "Please try again."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => accountsQuery.refetch()}>
            Retry
          </Button>
        </Card>
      ) : !accounts.length ? (
        <Card>
          <EmptyState
            icon={Landmark}
            title="Add your first account"
            description="Start with your main bank account. Enter today's balance, then link transactions to see it update."
            action={{ label: "Add an account", onClick: openCreate }}
            className="py-20"
          />
        </Card>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-[#071a16] p-6 text-white sm:p-8">
            <div className="absolute inset-0 surface-grid opacity-25" />
            <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/80">
                  Net worth · {data!.summary.account_count} active account
                  {data!.summary.account_count === 1 ? "" : "s"}
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] tabular">
                  {formatINR(data!.summary.net_worth)}
                </p>
                <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-white/45">{data!.summary.method}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                  <p className="text-[9px] uppercase tracking-wider text-white/35">You have</p>
                  <p className="mt-1 text-lg font-semibold tabular">{formatINR(data!.summary.assets)}</p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] p-3">
                  <p className="text-[9px] uppercase tracking-wider text-white/35">You owe</p>
                  <p className="mt-1 text-lg font-semibold tabular">{formatINR(data!.summary.liabilities)}</p>
                </div>
              </div>
            </div>
          </div>

          {data!.summary.unassigned_transactions > 0 && (
            <Card className="flex flex-col gap-2 p-4 text-xs sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-semibold">{data!.summary.unassigned_transactions}</span> transaction
                {data!.summary.unassigned_transactions === 1 ? " is" : "s are"} not linked to an account, so{" "}
                {data!.summary.unassigned_transactions === 1 ? "it is" : "they are"} left out of balances.
              </p>
              <Button size="sm" variant="outline" asChild>
                <Link to="/app/transactions?account=0">Review them</Link>
              </Button>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => {
              const kind = accountKind(account.kind);
              const Icon = kind.icon;
              return (
                <Card key={account.id} className={cn("overflow-hidden", account.is_archived && "opacity-60")}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-primary/10 bg-primary/5 text-primary">
                          <Icon className="size-[18px]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold">{accountLabel(account)}</h3>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {[account.institution, kind.label].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                      {account.is_archived ? (
                        <Badge variant="neutral">Archived</Badge>
                      ) : account.is_liability ? (
                        <Badge variant="warning">Owed</Badge>
                      ) : (
                        <Badge variant="success">Asset</Badge>
                      )}
                    </div>

                    <p className="mt-5 text-2xl font-semibold tracking-[-0.035em] tabular">
                      {formatINR(account.balance)}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {account.is_liability ? "Outstanding" : "Balance"} · from{" "}
                      {formatINR(account.opening_balance)} on {formatDate(account.opening_date)}
                    </p>

                    {account.credit_utilisation_pct !== null && (
                      <div className="mt-3">
                        <Progress value={Math.min(100, account.credit_utilisation_pct)} className="h-1.5" />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {account.credit_utilisation_pct}% of {formatINR(account.credit_limit)} limit used
                          {account.credit_utilisation_pct > 30 ? ". Above 30% can lower a credit score." : ""}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-secondary/50 px-2.5 py-2">
                        <p className="text-[9px] font-medium text-muted-foreground">Money in</p>
                        <p className="mt-0.5 text-[11px] font-semibold tabular">{formatINR(account.inflow)}</p>
                      </div>
                      <div className="rounded-lg bg-secondary/50 px-2.5 py-2">
                        <p className="text-[9px] font-medium text-muted-foreground">Money out</p>
                        <p className="mt-0.5 text-[11px] font-semibold tabular">{formatINR(account.outflow)}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <Link
                        to={`/app/transactions?account=${account.id}`}
                        className="text-[11px] font-medium text-primary hover:underline"
                      >
                        {account.transaction_count} entr{account.transaction_count === 1 ? "y" : "ies"}
                        {account.last_activity ? ` · last ${formatDate(account.last_activity, "d MMM")}` : ""}
                      </Link>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${account.name}`}
                          onClick={() => {
                            setEditing(account);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={account.is_archived ? `Restore ${account.name}` : `Archive ${account.name}`}
                          onClick={() => archiveMutation.mutate(account)}
                        >
                          {account.is_archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${account.name}`}
                          onClick={() => setDeleting(account)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card>
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold">Transfers</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Card bill payments, ATM withdrawals and top-ups. These move money but are not spending.
              </p>
              {transfers.length === 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">No transfers yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {transfers.slice(0, 20).map((transfer) => (
                    <li key={transfer.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {names.get(transfer.from_account_id) ?? "Account"} →{" "}
                          {names.get(transfer.to_account_id) ?? "Account"}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {formatDate(transfer.occurred_on)}
                          {transfer.note ? ` · ${transfer.note}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular">{formatINR(transfer.amount)}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Remove transfer"
                          onClick={() => deleteTransferMutation.mutate(transfer.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <AccountDialog open={dialogOpen} onOpenChange={setDialogOpen} account={editing} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} accounts={accounts} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this account?"
        description="Its transactions stay in your ledger, unlinked, and its transfers are removed. Budgets and analytics do not change."
        confirmLabel="Delete account"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
