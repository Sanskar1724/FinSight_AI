import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Spin } from "@/components/ui/spin";
import { api, ApiError } from "@/lib/api";
import type { Category, Transaction, TransactionPayload, TransactionType } from "@/lib/types";
import { cn, todayISO } from "@/lib/utils";

const paymentMethods = [
  "UPI",
  "Cash",
  "Debit Card",
  "Credit Card",
  "Net Banking",
  "Wallet",
  "Auto Debit",
  "Other",
];

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  defaultType?: TransactionType;
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  defaultType = "expense",
}: TransactionDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(transaction);
  const [type, setType] = useState<TransactionType>(defaultType);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
    staleTime: 10 * 60 * 1000,
  });

  const categories = (categoriesQuery.data ?? []).filter((category) => category.kind === type);

  useEffect(() => {
    if (!open) return;
    setError("");
    if (transaction) {
      setType(transaction.type);
      setAmount(String(transaction.amount));
      setDate(transaction.occurred_on);
      setMerchant(transaction.merchant);
      setCategoryId(String(transaction.category.id));
      setPaymentMethod(transaction.payment_method);
      setNotes(transaction.notes ?? "");
    } else {
      setType(defaultType);
      setAmount("");
      setDate(todayISO());
      setMerchant("");
      setCategoryId("");
      setPaymentMethod("UPI");
      setNotes("");
    }
  }, [open, transaction, defaultType]);

  useEffect(() => {
    if (!open) return;
    if (categories.length > 0 && !categories.some((category) => String(category.id) === categoryId)) {
      setCategoryId(String(categories[0].id));
    }
    if (categories.length === 0) setCategoryId("");
  }, [open, categories, categoryId]);

  const mutation = useMutation({
    mutationFn: (payload: TransactionPayload) =>
      isEdit
        ? api.patch<Transaction>(`/transactions/${transaction!.id}`, payload)
        : api.post<Transaction>("/transactions", payload),
    onSuccess: () => {
      toast.success(isEdit ? "Transaction updated" : "Transaction added");
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["goals"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not save the transaction");
    },
  });

  const submit = () => {
    setError("");
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter an amount greater than zero");
      return;
    }
    if (!merchant.trim()) {
      setError("Add a merchant or short description");
      return;
    }
    if (!categoryId) {
      setError("Choose a category");
      return;
    }
    mutation.mutate({
      type,
      amount: numericAmount.toFixed(2),
      occurred_on: date,
      category_id: Number(categoryId),
      merchant: merchant.trim(),
      notes: notes.trim() || undefined,
      payment_method: paymentMethod,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit transaction" : "Add a transaction"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the record. Budgets and insights will recalculate automatically."
              : "Record money that has already moved. All amounts are in Indian rupees."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
          {(
            [
              { value: "expense", label: "Expense", icon: ArrowUpRight },
              { value: "income", label: "Income", icon: ArrowDownLeft },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setType(item.value)}
                className={cn(
                  "flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all",
                  type === item.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="txn-amount">Amount (₹)</Label>
            <Input
              id="txn-amount"
              inputMode="decimal"
              placeholder="1,250"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="txn-date">Date</Label>
            <Input
              id="txn-date"
              type="date"
              max={todayISO()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="txn-merchant">
              {type === "income" ? "Source" : "Merchant or description"}
            </Label>
            <Input
              id="txn-merchant"
              placeholder={type === "income" ? "Monthly salary" : "Swiggy, grocery store…"}
              maxLength={160}
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="txn-category">Category</Label>
            <Select
              id="txn-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={categoriesQuery.isLoading}
            >
              {categoriesQuery.isLoading && <option value="">Loading categories…</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="txn-method">Payment method</Label>
          <Select
            id="txn-method"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value)}
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="txn-notes">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="txn-notes"
            placeholder="Anything useful to remember about this transaction"
            maxLength={2000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="min-h-[74px]"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending && <Spin />}
            {isEdit ? "Save changes" : "Add transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
