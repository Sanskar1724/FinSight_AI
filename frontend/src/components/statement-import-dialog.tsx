import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, FileText, Lock, ShieldCheck, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import { accountLabel } from "@/lib/accounts";
import { api, ApiError, errorCode } from "@/lib/api";
import type {
  AccountList,
  Category,
  StatementImportResult,
  StatementPreview,
  StatementPreviewRow,
  TransactionType,
} from "@/lib/types";
import { cn, formatDate, formatINR } from "@/lib/utils";

const MAX_BYTES = 10_000_000;

interface StatementImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StatementImportDialog({ open, onOpenChange }: StatementImportDialogProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [rows, setRows] = useState<StatementPreviewRow[]>([]);
  const [accountId, setAccountId] = useState("");
  const [result, setResult] = useState<StatementImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });
  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: () => api.get<AccountList>("/accounts"),
    enabled: open,
    staleTime: 60 * 1000,
  });
  const accounts = (accountsQuery.data?.accounts ?? []).filter((account) => !account.is_archived);
  const categories = categoriesQuery.data ?? [];

  const reset = () => {
    setFile(null);
    setPassword("");
    setNeedsPassword(false);
    setPreview(null);
    setRows([]);
    setAccountId("");
    setResult(null);
    setError("");
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const previewMutation = useMutation({
    mutationFn: ({ nextFile, pdfPassword }: { nextFile: File; pdfPassword: string }) => {
      const form = new FormData();
      form.append("file", nextFile);
      if (pdfPassword) form.append("password", pdfPassword);
      return api.post<StatementPreview>("/statements/preview", form);
    },
    onSuccess: (data) => {
      setNeedsPassword(false);
      setPreview(data);
      setRows(data.rows);
      setAccountId(data.suggested_account_id ? String(data.suggested_account_id) : "");
    },
    onError: (err) => {
      const code = errorCode(err);
      if (code === "password_required" || code === "password_incorrect") {
        setNeedsPassword(true);
        if (code === "password_incorrect") setError(err instanceof ApiError ? err.message : "Wrong password");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not read the statement");
    },
  });

  const importMutation = useMutation({
    mutationFn: () =>
      api.post<StatementImportResult>("/statements/import", {
        account_id: accountId ? Number(accountId) : null,
        rows: rows
          .filter((row) => row.include)
          .map((row) => ({
            occurred_on: row.occurred_on,
            type: row.type,
            amount: row.amount.toFixed(2),
            merchant: row.merchant.trim(),
            category_id: row.category_id,
            payment_method: row.payment_method,
            description: row.description,
          })),
      }),
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Imported ${data.imported} transaction${data.imported === 1 ? "" : "s"}`);
      for (const key of ["transactions", "dashboard", "analytics", "budgets", "notifications", "accounts"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Import failed"),
  });

  const selectFile = (next: File | null) => {
    setError("");
    setResult(null);
    setPreview(null);
    setRows([]);
    setNeedsPassword(false);
    setPassword("");
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF statement");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("The PDF is larger than the 10 MB limit");
      return;
    }
    setFile(next);
    previewMutation.mutate({ nextFile: next, pdfPassword: "" });
  };

  const updateRow = (rowNumber: number, changes: Partial<StatementPreviewRow>) => {
    setRows((current) => current.map((row) => (row.row_number === rowNumber ? { ...row, ...changes } : row)));
  };

  const flipType = (row: StatementPreviewRow) => {
    const nextType: TransactionType = row.type === "expense" ? "income" : "expense";
    const fallback = categories.find((c) => c.slug === (nextType === "expense" ? "other-expense" : "other-income"));
    updateRow(row.row_number, { type: nextType, category_id: fallback?.id ?? row.category_id });
  };

  const selected = useMemo(() => rows.filter((row) => row.include), [rows]);
  const selectedOut = selected.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount, 0);
  const selectedIn = selected.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount, 0);
  const invalidMerchant = selected.some((row) => !row.merchant.trim());

  const changeOpen = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const check = preview?.balance_check;

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[92vh] max-w-5xl grid-cols-[minmax(0,1fr)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import a bank or card statement</DialogTitle>
          <DialogDescription>
            Upload the PDF your bank emails or lets you download. FinSight reads it on the server, suggests a
            merchant and category for each row, and lets you review everything before saving. The PDF and its
            password are not stored.
          </DialogDescription>
        </DialogHeader>

        {!result && !preview && (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFile(event.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "rounded-2xl border border-dashed p-7 text-center transition-colors",
              dragging ? "border-primary/60 bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/30",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            />
            <div className="mx-auto grid size-11 place-items-center rounded-2xl border border-border bg-card text-primary">
              {file ? <FileText className="size-5" /> : <Upload className="size-5" />}
            </div>
            <p className="mt-3 text-sm font-semibold">{file ? file.name : "Drop your statement PDF here"}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {previewMutation.isPending
                ? "Reading the statement…"
                : "Text PDFs from SBI, HDFC, ICICI, Axis, Kotak and most other banks · up to 10 MB"}
            </p>
            {!previewMutation.isPending && (
              <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
                {file ? "Choose a different file" : "Browse files"}
              </Button>
            )}
          </div>
        )}

        {needsPassword && file && !preview && (
          <form
            className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/30 p-4 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              setError("");
              previewMutation.mutate({ nextFile: file, pdfPassword: password });
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="statement-password" className="flex items-center gap-1.5">
                <Lock className="size-3.5" /> This PDF is password protected
              </Label>
              <Input
                id="statement-password"
                type="password"
                autoComplete="off"
                placeholder="Often your name and date of birth, or customer ID"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" disabled={!password || previewMutation.isPending}>
              {previewMutation.isPending && <Spin />}
              Unlock
            </Button>
          </form>
        )}

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
            <p className="text-[11px] leading-relaxed text-rose-700">{error}</p>
          </div>
        )}

        {preview && !result && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold">
                {preview.bank ?? "Unknown bank"}
                {preview.account_last4 ? ` ·· ${preview.account_last4}` : ""}
                {preview.statement_type === "credit_card" ? " · credit card" : ""}
              </span>
              {preview.period_start && (
                <span className="rounded-full bg-secondary px-2.5 py-1">
                  {formatDate(preview.period_start, "d MMM")} – {formatDate(preview.period_end, "d MMM yyyy")}
                </span>
              )}
              <span className="rounded-full bg-secondary px-2.5 py-1">
                {preview.rows.length} rows · {preview.pages} page{preview.pages === 1 ? "" : "s"}
              </span>
            </div>

            {check && (
              <div
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[11px]",
                  check.status === "verified" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                  check.status === "mismatch" && "border-amber-200 bg-amber-50 text-amber-800",
                  check.status === "unchecked" && "border-border bg-secondary/40 text-muted-foreground",
                )}
              >
                {check.status === "verified" ? (
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">
                    {check.status === "verified"
                      ? "Verified against the statement's balances"
                      : check.status === "mismatch"
                        ? "Some rows do not match the statement's balances"
                        : "Could not check against balances"}
                  </p>
                  <p className="mt-0.5 leading-relaxed">{check.detail}</p>
                </div>
              </div>
            )}

            {preview.warnings.map((warning) => (
              <p key={warning} className="text-[11px] text-amber-700">
                {warning}
              </p>
            ))}

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="statement-account">Account these rows belong to</Label>
                <Select id="statement-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  <option value="">Don't link to an account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {accountLabel(account)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex gap-2 text-[11px]">
                <Button size="sm" variant="outline" onClick={() => setRows((r) => r.map((row) => ({ ...row, include: !row.duplicate })))}>
                  Select all new
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRows((r) => r.map((row) => ({ ...row, include: false })))}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-left text-[11px]">
                <thead className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="w-8 px-3 py-2" />
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Merchant</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.row_number} className={cn(!row.include && "bg-secondary/20 text-muted-foreground")}>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          aria-label={`Import row ${row.row_number}`}
                          checked={row.include}
                          onChange={(event) => updateRow(row.row_number, { include: event.target.checked })}
                          className="mt-1.5 size-4 accent-primary"
                        />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 align-top tabular">
                        <span className="mt-1.5 inline-block">{formatDate(row.occurred_on, "d MMM")}</span>
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Input
                          aria-label={`Merchant for row ${row.row_number}`}
                          value={row.merchant}
                          maxLength={160}
                          onChange={(event) => updateRow(row.row_number, { merchant: event.target.value })}
                          className="h-8 text-xs"
                        />
                        <p className="mt-1 line-clamp-2 break-all text-[10px] text-muted-foreground" title={row.description}>
                          {row.description}
                        </p>
                        {row.note && (
                          <p className={cn("mt-1 text-[10px]", row.is_transfer ? "text-sky-700" : "text-amber-700")}>
                            {row.note}
                          </p>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <Select
                          aria-label={`Category for row ${row.row_number}`}
                          value={row.category_id}
                          onChange={(event) =>
                            updateRow(row.row_number, { category_id: Number(event.target.value), category_source: "history" })
                          }
                          className="h-8 text-xs"
                        >
                          {categories
                            .filter((category) => category.kind === row.type)
                            .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                        </Select>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {row.category_source === "history"
                            ? "From your past choices"
                            : row.category_source === "rule"
                              ? "Suggested from the merchant"
                              : "No match, please check"}
                          {" · "}
                          {row.payment_method}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right align-top">
                        <p className={cn("mt-1.5 font-semibold tabular", row.type === "income" ? "text-emerald-700" : "")}>
                          {row.type === "income" ? "+" : "−"}
                          {formatINR(row.amount)}
                        </p>
                        <button
                          type="button"
                          onClick={() => flipType(row)}
                          className="mt-1 text-[10px] font-medium text-primary hover:underline"
                        >
                          Mark as {row.type === "expense" ? "money in" : "money out"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
            <p className="mt-2 text-sm font-semibold text-emerald-900">
              Imported {result.imported} transaction{result.imported === 1 ? "" : "s"}
            </p>
            <p className="mt-1 text-[11px] text-emerald-800">
              {result.skipped_duplicates} duplicate{result.skipped_duplicates === 1 ? "" : "s"} skipped
              {result.failed ? ` · ${result.failed} failed` : ""}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 text-left text-[10px] text-rose-700">
                {result.errors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          {preview && !result ? (
            <p className="text-[11px] text-muted-foreground">
              {selected.length} selected · {formatINR(selectedOut)} out · {formatINR(selectedIn)} in
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {result ? (
              <>
                <Button variant="outline" onClick={reset}>
                  Import another
                </Button>
                <Button onClick={() => changeOpen(false)}>Done</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => (preview ? reset() : changeOpen(false))}>
                  {preview ? "Start over" : "Cancel"}
                </Button>
                {preview && (
                  <Button
                    onClick={() => {
                      setError("");
                      if (invalidMerchant) {
                        setError("Every selected row needs a merchant name.");
                        return;
                      }
                      importMutation.mutate();
                    }}
                    disabled={selected.length === 0 || importMutation.isPending}
                  >
                    {importMutation.isPending && <Spin />}
                    Import {selected.length} row{selected.length === 1 ? "" : "s"}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
