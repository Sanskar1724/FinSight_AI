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
import { Switch } from "@/components/ui/switch";
import { Spin } from "@/components/ui/spin";
import { api, ApiError } from "@/lib/api";
import type { Bill } from "@/lib/types";
import { todayISO } from "@/lib/utils";

interface BillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: Bill | null;
}

export function BillDialog({ open, onOpenChange, bill }: BillDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(bill);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(bill?.name ?? "");
    setAmount(bill ? String(bill.amount) : "");
    setDueDate(bill?.due_date ?? todayISO());
    setPaid(bill?.is_paid ?? false);
  }, [open, bill]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        amount: Number(amount).toFixed(2),
        due_date: dueDate,
        is_paid: paid,
      };
      return isEdit
        ? api.patch<Bill>(`/bills/${bill!.id}`, payload)
        : api.post<Bill>("/bills", payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Bill updated" : "Bill reminder created");
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Could not save the bill"),
  });

  const submit = () => {
    setError("");
    if (name.trim().length < 2) {
      setError("Give the bill a name with at least 2 characters");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit bill reminder" : "Add a bill reminder"}</DialogTitle>
          <DialogDescription>
            Reminders are based on the due date you enter. FinSight does not auto-pay bills.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="bill-name">Bill name</Label>
          <Input
            id="bill-name"
            placeholder="Electricity, rent, internet…"
            maxLength={140}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bill-amount">Amount (₹)</Label>
            <Input
              id="bill-amount"
              inputMode="decimal"
              placeholder="1,500"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bill-date">Due date</Label>
            <Input
              id="bill-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3">
          <div>
            <p className="text-xs font-semibold">Already paid</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Paid bills no longer trigger reminders.
            </p>
          </div>
          <Switch checked={paid} onCheckedChange={setPaid} />
        </div>
        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Spin />}
            {isEdit ? "Save changes" : "Add bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
