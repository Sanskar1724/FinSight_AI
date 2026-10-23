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
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spin } from "@/components/ui/spin";
import { api, ApiError } from "@/lib/api";
import type { Goal } from "@/lib/types";
import { formatINR, todayISO } from "@/lib/utils";

function invalidateGoals(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["goals"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["notifications"] });
}

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: Goal | null;
}

export function GoalDialog({ open, onOpenChange, goal }: GoalDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(goal);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setName(goal?.name ?? "");
    setTarget(goal ? String(goal.target_amount) : "");
    setDate(goal?.target_date ?? "");
  }, [open, goal]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        target_amount: Number(target).toFixed(2),
        target_date: date || null,
      };
      return isEdit
        ? api.patch<Goal>(`/goals/${goal!.id}`, payload)
        : api.post<Goal>("/goals", payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? "Goal updated" : "Goal created");
      invalidateGoals(queryClient);
      onOpenChange(false);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not save the goal"),
  });

  const submit = () => {
    setError("");
    if (name.trim().length < 2) {
      setError("Give the goal a name with at least 2 characters");
      return;
    }
    const amount = Number(target);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a target amount greater than zero");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit savings goal" : "Create a savings goal"}</DialogTitle>
          <DialogDescription>
            A target date is optional. With one, FinSight can calculate the monthly pace needed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="goal-name">Goal name</Label>
          <Input
            id="goal-name"
            placeholder="Emergency fund, New laptop, Japan trip…"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">Target amount (₹)</Label>
            <Input
              id="goal-target"
              inputMode="decimal"
              placeholder="100,000"
              value={target}
              onChange={(event) => setTarget(event.target.value.replace(/[^0-9.]/g, ""))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-date">
              Target date <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="goal-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </div>
        {target && Number(target) > 0 && (
          <p className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
            Target: <span className="font-semibold text-foreground">{formatINR(Number(target))}</span>
            {date
              ? " · FinSight will show the monthly pace needed to reach it on time."
              : " · Add a date to see a required monthly pace."}
          </p>
        )}
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
            {isEdit ? "Save changes" : "Create goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
}

export function ContributionDialog({ open, onOpenChange, goal }: ContributionDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setDate(todayISO());
    setNote("");
    setError("");
  }, [open, goal]);

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Goal>(`/goals/${goal!.id}/contributions`, {
        amount: Number(amount).toFixed(2),
        contributed_on: date,
        note: note.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Contribution added");
      invalidateGoals(queryClient);
      onOpenChange(false);
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Could not add the contribution"),
  });

  const submit = () => {
    setError("");
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (date > todayISO()) {
      setError("Contributions cannot be dated in the future");
      return;
    }
    mutation.mutate();
  };

  if (!goal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add to “{goal.name}”</DialogTitle>
          <DialogDescription>
            {formatINR(goal.saved_amount)} saved of {formatINR(goal.target_amount)}. Record a
            contribution to update progress.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="contribution-amount">Contribution amount (₹)</Label>
          <Input
            id="contribution-amount"
            inputMode="decimal"
            placeholder="5,000"
            value={amount}
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contribution-date">Date</Label>
          <Input
            id="contribution-date"
            type="date"
            max={todayISO()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contribution-note">
            Note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="contribution-note"
            placeholder="Monthly transfer, bonus, sold something…"
            maxLength={255}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="min-h-[70px]"
          />
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
            Add contribution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
