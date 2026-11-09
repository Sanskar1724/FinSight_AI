import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spin } from "@/components/ui/spin";
import { accountKind, accountKinds, accountLabel } from "@/lib/accounts";
import { api, ApiError } from "@/lib/api";
import type { Account, AccountKind, AccountTransfer } from "@/lib/types";
import { todayISO } from "@/lib/utils";

function invalidateAccounts(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["accounts"] });
  void queryClient.invalidateQueries({ queryKey: ["transfers"] });
  void queryClient.invalidateQueries({ queryKey: ["transactions"] });
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
      {message}
    </p>
  );
}

const money = (value: string) => value.replace(/[^0-9.]/g, "");

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
}

export function AccountDialog({ open, onOpenChange, account }: AccountDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(account);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("bank");
  const [institution, setInstitution] = useState("");
  const [last4, setLast4] = useState("");
  const [opening, setOpening] = useState("");
  const [openingDate, setOpeningDate] = useState(todayISO());
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(account?.name ?? "");
    setKind(account?.kind ?? "bank");
    setInstitution(account?.institution ?? "");
    setLast4(account?.last4 ?? "");
    setOpening(account ? String(account.opening_balance) : "");
    setOpeningDate(account?.opening_date ?? todayISO());
    setLimit(account?.credit_limit != null ? String(account.credit_limit) : "");
  }, [open, account]);

  const liability = accountKind(kind).liability;

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        kind,
        institution: institution.trim() || null,
        last4: last4 || null,
        opening_balance: Number(opening || 0).toFixed(2),
        opening_date: openingDate,
        credit_limit: kind === "credit_card" && limit ? Number(limit).toFixed(2) : null,
      };
      return isEdit
        ? api.patch<Account>(`/accounts/${account!.id}`, payload)
        : api.post<Account>("/accounts", payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Account updated" : "Account added");
      invalidateAccounts(queryClient);
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save the account"),
  });

  const submit = () => {
    setError("");
    if (!name.trim()) return setError("Give the account a name");
    if (last4 && !/^\d{4}$/.test(last4)) return setError("Last 4 digits must be exactly 4 numbers");
    if (opening && !Number.isFinite(Number(opening))) return setError("Enter a valid opening balance");
    if (!openingDate) return setError("Choose the date the opening balance is from");
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit account" : "Add an account"}</DialogTitle>
          <DialogDescription>
            Enter the balance on a date you know. FinSight adds every linked transaction from that date on.
            It never connects to your bank.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              placeholder="Salary account"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-kind">Type</Label>
            <Select id="account-kind" value={kind} onChange={(event) => setKind(event.target.value as AccountKind)}>
              {accountKinds.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-institution">
              Bank or provider <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="account-institution"
              placeholder="SBI, HDFC Bank, Paytm…"
              maxLength={120}
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-last4">
              Last 4 digits <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="account-last4"
              inputMode="numeric"
              placeholder="1234"
              maxLength={4}
              value={last4}
              onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-opening">{liability ? "Amount owed (₹)" : "Balance (₹)"}</Label>
            <Input
              id="account-opening"
              inputMode="decimal"
              placeholder="0"
              value={opening}
              onChange={(event) => setOpening(event.target.value.replace(/[^0-9.-]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-opening-date">As of</Label>
            <Input
              id="account-opening-date"
              type="date"
              value={openingDate}
              onChange={(event) => setOpeningDate(event.target.value)}
            />
          </div>
          {kind === "credit_card" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="account-limit">
                Credit limit (₹) <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="account-limit"
                inputMode="decimal"
                placeholder="75,000"
                value={limit}
                onChange={(event) => setLimit(money(event.target.value))}
              />
            </div>
          )}
        </div>
        <ErrorNote message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Spin />}
            {isEdit ? "Save changes" : "Add account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
}

export function TransferDialog({ open, onOpenChange, accounts }: TransferDialogProps) {
  const queryClient = useQueryClient();
  const active = accounts.filter((account) => !account.is_archived);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    const bank = active.find((account) => !account.is_liability);
    const card = active.find((account) => account.is_liability);
    setFromId(bank ? String(bank.id) : "");
    setToId(card ? String(card.id) : "");
    setAmount("");
    setDate(todayISO());
    setNote("");
    // Only reset when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<AccountTransfer>("/accounts/transfers", {
        from_account_id: Number(fromId),
        to_account_id: Number(toId),
        amount: Number(amount).toFixed(2),
        occurred_on: date,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Transfer recorded");
      invalidateAccounts(queryClient);
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not record the transfer"),
  });

  const submit = () => {
    setError("");
    if (!fromId || !toId) return setError("Choose both accounts");
    if (fromId === toId) return setError("Choose two different accounts");
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than zero");
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move money between accounts</DialogTitle>
          <DialogDescription>
            For a card bill payment, an ATM withdrawal or a wallet top-up. Transfers change balances but are not
            counted as income or spending.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="transfer-from">From</Label>
            <Select id="transfer-from" value={fromId} onChange={(event) => setFromId(event.target.value)}>
              <option value="">Choose…</option>
              {active.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="transfer-to">To</Label>
            <Select id="transfer-to" value={toId} onChange={(event) => setToId(event.target.value)}>
              <option value="">Choose…</option>
              {active.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="transfer-amount">Amount (₹)</Label>
            <Input
              id="transfer-amount"
              inputMode="decimal"
              placeholder="5,000"
              value={amount}
              onChange={(event) => setAmount(money(event.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="transfer-date">Date</Label>
            <Input id="transfer-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="transfer-note">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="transfer-note"
              placeholder="Card bill for October"
              maxLength={240}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
        <ErrorNote message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Spin />}
            Record transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
