import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { api, ApiError } from "@/lib/api";
import type { Budget, Category } from "@/lib/types";
import { formatINR, monthLabel } from "@/lib/utils";

interface BudgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  budget?: Budget | null;
  existing: Budget[];
}

export function BudgetDialog({
  open,
  onOpenChange,
  month,
  budget,
  existing,
}: BudgetDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(budget);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [warning, setWarning] = useState("70");
  const [critical, setCritical] = useState("90");
  const [error, setError] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
    staleTime: 10 * 60 * 1000,
  });

  const available = useMemo(() => {
    const used = new Set(existing.map((item) => item.category.id));
    return (categoriesQuery.data ?? []).filter(
      (category) =>
        category.kind === "expense" &&
        (isEdit ? category.id === budget?.category.id : !used.has(category.id)),
    );
  }, [categoriesQuery.data, existing, isEdit, budget?.category.id]);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (budget) {
      setCategoryId(String(budget.category.id));
      setAmount(String(budget.limit_amount));
      setWarning(String(budget.warning_threshold));
      setCritical(String(budget.critical_threshold));
    } else {
      setCategoryId("");
      setAmount("");
      setWarning("70");
      setCritical("90");
    }
  }, [open, budget]);

  useEffect(() => {
    if (!open || available.length === 0) return;
    if (!available.some((category) => String(category.id) === categoryId)) {
      setCategoryId(String(available[0].id));
    }
  }, [open, available, categoryId]);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        limit_amount: Number(amount).toFixed(2),
        warning_threshold: Number(warning),
        critical_threshold: Number(critical),
      };
      return isEdit
        ? api.patch<Budget>(`/budgets/${budget!.id}`, payload)
        : api.post<Budget>("/budgets", {
            category_id: Number(categoryId),
            month: `${month}-01`,
            ...payload,
          });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Budget updated" : "Budget created");
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not save the budget");
    },
  });

  const submit = () => {
    setError("");
    if (!isEdit && !categoryId) {
      setError("Choose an expense category");
      return;
    }
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError("Enter a monthly limit greater than zero");
      return;
    }
    const warningValue = Number(warning);
    const criticalValue = Number(critical);
    if (
      !Number.isFinite(warningValue) ||
      !Number.isFinite(criticalValue) ||
      warningValue < 1 ||
      warningValue > 99 ||
      criticalValue <= warningValue ||
      criticalValue > 100
    ) {
      setError("Critical must be greater than warning, between 1 and 100");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "Create a monthly budget"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Adjust the limit and alert thresholds for ${monthLabel(month)}.`
              : `Set a spending limit for ${monthLabel(month)}. Thresholds control when alerts begin.`}
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 && !isEdit ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
            Every expense category already has a budget for this month.
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="budget-category">Category</Label>
              <Select
                id="budget-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={isEdit}
              >
                {available.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget-amount">Monthly limit (₹)</Label>
              <Input
                id="budget-amount"
                inputMode="decimal"
                placeholder="5,000"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                autoFocus
              />
              {amount && Number(amount) > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  {formatINR(Number(amount))} per month
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="budget-warning">Warning at (%)</Label>
                <Input
                  id="budget-warning"
                  type="number"
                  min={1}
                  max={99}
                  value={warning}
                  onChange={(event) => setWarning(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget-critical">Critical at (%)</Label>
                <Input
                  id="budget-critical"
                  type="number"
                  min={2}
                  max={100}
                  value={critical}
                  onChange={(event) => setCritical(event.target.value)}
                />
              </div>
            </div>
            <div className="rounded-xl border border-border bg-secondary/35 p-3">
              <div className="flex h-2 overflow-hidden rounded-full bg-card">
                <div className="bg-emerald-400" style={{ width: `${warning}%` }} />
                <div className="bg-amber-400" style={{ width: `${Math.max(0, Number(critical) - Number(warning))}%` }} />
                <div className="flex-1 bg-rose-400" />
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                Healthy below {warning}% · warning from {warning}% · critical from {critical}% ·
                exceeded past 100%.
              </p>
            </div>
          </>
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
          <Button
            onClick={submit}
            disabled={mutation.isPending || (!isEdit && available.length === 0)}
          >
            {mutation.isPending && <Spin />}
            {isEdit ? "Save budget" : "Create budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
