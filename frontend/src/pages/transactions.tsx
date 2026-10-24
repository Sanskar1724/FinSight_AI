import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/category-icon";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CsvImportDialog } from "@/components/csv-import-dialog";
import { TransactionDialog } from "@/components/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spin } from "@/components/ui/spin";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { api, ApiError, buildQuery, downloadBlob } from "@/lib/api";
import type { Category, Transaction, TransactionPage, TransactionType } from "@/lib/types";
import { cn, formatDate, formatINR, todayISO } from "@/lib/utils";

const PAGE_SIZE = 15;

export default function TransactionsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [type, setType] = useState<"" | TransactionType>("");
  const [categoryId, setCategoryId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [flagged, setFlagged] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;
    if (next.get("new") === "1") {
      setEditing(null);
      setDialogOpen(true);
      next.delete("new");
      changed = true;
    }
    if (next.get("import") === "1") {
      setCsvOpen(true);
      next.delete("import");
      changed = true;
    }
    const flaggedParam = next.get("flagged");
    if (flaggedParam && /^\d+$/.test(flaggedParam)) {
      setFlagged(flaggedParam);
      next.delete("flagged");
      changed = true;
    }
    const searchParam = next.get("search");
    if (searchParam) {
      setSearch(searchParam.slice(0, 120));
      next.delete("search");
      changed = true;
    }
    const categoryParam = next.get("category");
    if (categoryParam && /^\d+$/.test(categoryParam)) {
      setCategoryId(categoryParam);
      next.delete("category");
      changed = true;
    }
    if (changed) setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type, categoryId, start, end, flagged, sort]);

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/categories"),
    staleTime: 10 * 60 * 1000,
  });

  const query = useQuery({
    queryKey: [
      "transactions",
      { search: debouncedSearch, type, categoryId, start, end, flagged, sort, page },
    ],
    queryFn: () =>
      api.get<TransactionPage>(
        `/transactions${buildQuery({
          search: debouncedSearch || undefined,
          type: type || undefined,
          category_id: categoryId || undefined,
          start: start || undefined,
          end: end || undefined,
          flagged: flagged || undefined,
          sort,
          page,
          page_size: PAGE_SIZE,
        })}`,
      ),
    placeholderData: keepPreviousData,
  });

  const invalidateLedger = () => {
    void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    void queryClient.invalidateQueries({ queryKey: ["budgets"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/transactions/${id}`),
    onSuccess: () => {
      toast.success("Transaction deleted");
      setDeleting(null);
      invalidateLedger();
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete the transaction");
    },
  });

  const exportData = async () => {
    setExporting(true);
    try {
      await downloadBlob(
        `/transactions/export${buildQuery({
          search: debouncedSearch || undefined,
          type: type || undefined,
          category_id: categoryId || undefined,
          start: start || undefined,
          end: end || undefined,
          flagged: flagged || undefined,
        })}`,
        `finsight-transactions-${todayISO()}.csv`,
      );
      toast.success("CSV export downloaded");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const activeFilters = [type, categoryId, start, end, flagged].filter(Boolean).length;
  const rows = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const pages = query.data?.pages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const clearFilters = () => {
    setSearch("");
    setType("");
    setCategoryId("");
    setStart("");
    setEnd("");
    setFlagged("");
    setSort("date_desc");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Your ledger"
        title="Transactions"
        description="Every income and expense in one auditable place. Filter, edit, import, or export your records."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
              <Upload className="size-3.5" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={exportData} disabled={exporting}>
              {exporting ? <Spin /> : <ArrowDownToLine className="size-3.5" />}
              Export
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add transaction
            </Button>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search merchant, notes, or category…"
                className="pl-9 pr-9"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={filtersOpen || activeFilters > 0 ? "secondary" : "outline"}
                size="default"
                onClick={() => setFiltersOpen((value) => !value)}
              >
                <SlidersHorizontal className="size-4" />
                Filters
                {activeFilters > 0 && (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                    {activeFilters}
                  </span>
                )}
              </Button>
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="w-[155px]"
                aria-label="Sort transactions"
              >
                <option value="date_desc">Newest first</option>
                <option value="date_asc">Oldest first</option>
                <option value="amount_desc">Highest amount</option>
                <option value="amount_asc">Lowest amount</option>
              </Select>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-3 grid animate-fade-in gap-3 rounded-xl border border-border/70 bg-secondary/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </label>
                <Select value={type} onChange={(event) => setType(event.target.value as "" | TransactionType)}>
                  <option value="">All types</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Category
                </label>
                <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">All categories</option>
                  {(categoriesQuery.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.kind})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  From
                </label>
                <Input
                  type="date"
                  value={start}
                  max={end || undefined}
                  onChange={(event) => setStart(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  To
                </label>
                <Input
                  type="date"
                  value={end}
                  min={start || undefined}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                >
                  <X className="size-3" />
                  Clear all filters
                </button>
              </div>
            </div>
          )}

          {(categoryId || flagged) && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Active:</span>
              {categoryId && (
                <button
                  type="button"
                  onClick={() => setCategoryId("")}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold text-primary"
                >
                  {(categoriesQuery.data ?? []).find((item) => String(item.id) === categoryId)?.name ??
                    "Category"}
                  <X className="size-3" />
                </button>
              )}
              {flagged && (
                <button
                  type="button"
                  onClick={() => setFlagged("")}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700"
                >
                  Unusual only
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {query.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold">Transactions could not load</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {query.error instanceof ApiError ? query.error.message : "Please try again."}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => query.refetch()}>
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title={activeFilters || search ? "No matching transactions" : "No transactions yet"}
              description={
                activeFilters || search
                  ? "Try widening your filters or clearing the search."
                  : "Add a transaction or import a CSV to start building your ledger."
              }
              action={{
                label: activeFilters || search ? "Clear filters" : "Add transaction",
                onClick: () => {
                  if (activeFilters || search) clearFilters();
                  else {
                    setEditing(null);
                    setDialogOpen(true);
                  }
                },
              }}
              className="py-16"
            />
          ) : (
            <>
              <table className="hidden w-full min-w-[760px] text-left md:table">
                <thead>
                  <tr className="border-b border-border/70 bg-secondary/35 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-3 py-3">Transaction</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Method</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="w-[90px] px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/55">
                  {rows.map((txn) => (
                    <tr key={txn.id} className="group transition-colors hover:bg-secondary/25">
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs tabular text-muted-foreground">
                        {formatDate(txn.occurred_on, "d MMM yyyy")}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <CategoryIcon
                            icon={txn.category.icon}
                            color={txn.category.color}
                            className="size-8 rounded-lg"
                          />
                          <div className="min-w-0">
                            <p className="max-w-[260px] truncate text-xs font-semibold">
                              {txn.merchant}
                            </p>
                            {txn.notes && (
                              <p className="max-w-[260px] truncate text-[10px] text-muted-foreground">
                                {txn.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                          <span
                            className="size-1.5 rounded-full"
                            style={{ backgroundColor: txn.category.color }}
                          />
                          {txn.category.name}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-[11px] text-muted-foreground">
                        {txn.payment_method}
                      </td>
                      <td
                        className={cn(
                          "whitespace-nowrap px-3 py-3.5 text-right text-xs font-semibold tabular",
                          txn.type === "income" ? "text-emerald-700" : "text-foreground",
                        )}
                      >
                        {txn.type === "income" ? "+" : "−"}
                        {formatINR(txn.amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1 opacity-50 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditing(txn);
                              setDialogOpen(true);
                            }}
                            aria-label={`Edit ${txn.merchant}`}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => setDeleting(txn)}
                            aria-label={`Delete ${txn.merchant}`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="divide-y divide-border/60 md:hidden">
                {rows.map((txn) => (
                  <div key={txn.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <CategoryIcon
                        icon={txn.category.icon}
                        color={txn.category.color}
                        className="size-9 rounded-xl"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold">{txn.merchant}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {txn.category.name} · {formatDate(txn.occurred_on, "d MMM yyyy")}
                            </p>
                          </div>
                          <p
                            className={cn(
                              "shrink-0 text-xs font-semibold tabular",
                              txn.type === "income" ? "text-emerald-700" : "text-foreground",
                            )}
                          >
                            {txn.type === "income" ? "+" : "−"}
                            {formatINR(txn.amount)}
                          </p>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="rounded bg-secondary px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
                            {txn.payment_method}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditing(txn);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="size-3" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600"
                              onClick={() => setDeleting(txn)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{from}</span>–
              <span className="font-semibold text-foreground">{to}</span> of{" "}
              <span className="font-semibold text-foreground">{total}</span>
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
              <span className="px-2 text-[11px] font-medium text-muted-foreground">
                Page {page} of {pages}
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

      <div className="flex items-center justify-center gap-5 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ArrowUpDown className="size-3" />
          Tip: search includes notes and categories
        </span>
        <span className="hidden items-center gap-1.5 sm:inline-flex">
          <FileSpreadsheet className="size-3" />
          Exports follow the active filters
        </span>
      </div>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        transaction={editing}
      />
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this transaction?"
        description={
          deleting
            ? `${deleting.merchant} · ${formatINR(deleting.amount)} on ${formatDate(deleting.occurred_on)}. Budgets, goals, and insights will recalculate.`
            : ""
        }
        confirmLabel="Delete transaction"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
