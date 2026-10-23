import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
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
import { Spin } from "@/components/ui/spin";
import { api, ApiError } from "@/lib/api";
import type { CSVImportResult, CSVPreview } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  return String(value);
}

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const selectFile = (next: File | null) => {
    setError("");
    setResult(null);
    setPreview(null);
    if (!next) {
      setFile(null);
      return;
    }
    if (!next.name.toLowerCase().endsWith(".csv")) {
      setError("Choose a .csv file");
      return;
    }
    if (next.size > 2_000_000) {
      setError("The file is larger than the 2 MB import limit");
      return;
    }
    setFile(next);
    previewMutation.mutate(next);
  };

  const previewMutation = useMutation({
    mutationFn: (nextFile: File) => {
      const form = new FormData();
      form.append("file", nextFile);
      return api.post<CSVPreview>("/transactions/import/preview", form);
    },
    onSuccess: (data) => setPreview(data),
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not read the CSV file");
    },
  });

  const importMutation = useMutation({
    mutationFn: (nextFile: File) => {
      const form = new FormData();
      form.append("file", nextFile);
      return api.post<CSVImportResult>("/transactions/import", form);
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Imported ${data.imported} transaction${data.imported === 1 ? "" : "s"}`);
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["budgets"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Import failed"),
  });

  const changeOpen = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const downloadTemplate = () => {
    const content =
      "date,type,amount,category,merchant,payment_method,notes\n" +
      `${new Date().toISOString().slice(0, 10)},expense,450.00,Food & Dining,Chai Point,UPI,Evening chai\n` +
      `${new Date().toISOString().slice(0, 10)},income,50000.00,Salary,Acme Studios,Net Banking,Monthly salary\n`;
    const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "finsight-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const sampleRows = preview?.rows.slice(0, 8) ?? [];

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import transactions from CSV</DialogTitle>
          <DialogDescription>
            Required columns: date, amount, category, merchant. Type and payment method are
            optional. Duplicate rows are skipped automatically.
          </DialogDescription>
        </DialogHeader>

        {!result && (
          <>
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
                dragging
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-secondary/30 hover:border-primary/30",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
              />
              <div className="mx-auto grid size-11 place-items-center rounded-2xl border border-border bg-card text-primary">
                <Upload className="size-5" />
              </div>
              {file ? (
                <>
                  <p className="mt-3 text-sm font-semibold">{file.name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB ·{" "}
                    {previewMutation.isPending ? "Reading and validating…" : "Ready to review"}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => inputRef.current?.click()}
                  >
                    Choose a different file
                  </Button>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-semibold">Drop your CSV here</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Maximum 2 MB · UTF-8 or BOM-prefixed CSV
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => inputRef.current?.click()}
                  >
                    Browse files
                  </Button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary hover:underline"
            >
              <Download className="size-3.5" />
              Download a CSV template
            </button>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-600" />
            <div>
              <p className="text-xs font-semibold text-rose-800">Could not import this file</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-rose-700">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              className="ml-auto text-rose-700"
              onClick={() => {
                setError("");
                if (file) previewMutation.mutate(file);
              }}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        )}

        {previewMutation.isPending && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-8 text-sm text-muted-foreground">
            <Spin />
            Validating rows against your ledger…
          </div>
        )}

        {preview && !result && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                  Ready
                </p>
                <p className="mt-1 text-xl font-semibold tabular text-emerald-800">
                  {preview.valid_count}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  Duplicates
                </p>
                <p className="mt-1 text-xl font-semibold tabular text-amber-800">
                  {preview.duplicate_count}
                </p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                  Invalid
                </p>
                <p className="mt-1 text-xl font-semibold tabular text-rose-800">
                  {preview.error_count}
                </p>
              </div>
            </div>

            <div className="max-h-[260px] overflow-auto rounded-xl border border-border">
              <table className="w-full min-w-[600px] text-left text-[11px]">
                <thead className="sticky top-0 bg-secondary text-[9px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Row</th>
                    <th className="px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 font-semibold">Merchant</th>
                    <th className="px-3 py-2.5 font-semibold">Category</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2.5 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-card">
                  {sampleRows.map((row) => (
                    <tr key={row.row_number}>
                      <td className="px-3 py-2 text-muted-foreground">{row.row_number}</td>
                      <td className="px-3 py-2 tabular">{stringValue(row.data.date)}</td>
                      <td className="max-w-[150px] truncate px-3 py-2 font-medium">
                        {stringValue(row.data.merchant)}
                      </td>
                      <td className="max-w-[130px] truncate px-3 py-2">
                        {stringValue(row.data.category)}
                      </td>
                      <td className="px-3 py-2 text-right tabular">
                        {stringValue(row.data.amount)}
                      </td>
                      <td className="px-3 py-2">
                        {row.duplicate ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                            Duplicate
                          </span>
                        ) : row.valid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
                            <CheckCircle2 className="size-2.5" /> Ready
                          </span>
                        ) : (
                          <span
                            className="inline-flex max-w-[180px] items-center gap-1 truncate rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-semibold text-rose-700"
                            title={row.errors.join("; ")}
                          >
                            <AlertCircle className="size-2.5 shrink-0" />
                            {row.errors[0] ?? "Invalid"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length > sampleRows.length && (
              <p className="text-[10px] text-muted-foreground">
                Showing the first {sampleRows.length} of {preview.rows.length} previewed rows.
              </p>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-full bg-emerald-600 text-white">
              <CheckCircle2 className="size-5" />
            </div>
            <h3 className="mt-3 text-base font-semibold text-emerald-950">Import complete</h3>
            <p className="mt-1 text-xs text-emerald-800">
              {result.imported} imported · {result.skipped_duplicates} duplicates skipped ·{" "}
              {result.failed} failed
            </p>
            {result.errors.length > 0 && (
              <div className="mx-auto mt-3 max-w-md rounded-xl border border-amber-200 bg-amber-50 p-3 text-left">
                {result.errors.slice(0, 5).map((item, index) => (
                  <p key={index} className="text-[10px] leading-relaxed text-amber-800">
                    {item}
                  </p>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" onClick={reset}>
                <FileSpreadsheet className="size-3.5" />
                Import another
              </Button>
              <Button size="sm" onClick={() => changeOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}

        {!result && (
          <DialogFooter>
            <Button variant="outline" onClick={() => changeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => file && importMutation.mutate(file)}
              disabled={
                !file ||
                !preview ||
                preview.valid_count === 0 ||
                importMutation.isPending ||
                previewMutation.isPending
              }
            >
              {importMutation.isPending && <Spin />}
              Import {preview ? `${preview.valid_count} row${preview.valid_count === 1 ? "" : "s"}` : ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
