import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BellRing,
  CornerDownLeft,
  FileUp,
  MessageSquareText,
  Plus,
  ReceiptText,
  Repeat,
  Search,
  ShieldAlert,
  Target,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { navigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  group: "Search" | "Actions" | "Go to";
  label: string;
  icon: LucideIcon;
  to: string;
  hint?: string;
  keywords?: string;
}

const actions: Command[] = [
  { id: "new-txn", group: "Actions", label: "Add a transaction", icon: Plus, to: "/app/transactions?new=1", keywords: "expense income record spend" },
  { id: "import", group: "Actions", label: "Import a CSV", icon: FileUp, to: "/app/transactions?import=1", keywords: "upload bank statement" },
  { id: "new-budget", group: "Actions", label: "Create a budget", icon: WalletCards, to: "/app/budgets?new=1", keywords: "limit" },
  { id: "new-goal", group: "Actions", label: "Create a savings goal", icon: Target, to: "/app/goals?new=1", keywords: "save target" },
  { id: "flagged", group: "Actions", label: "Review unusual spending", icon: ShieldAlert, to: "/app/transactions?flagged=1", keywords: "anomaly outlier flagged" },
  { id: "recurring", group: "Actions", label: "Review recurring payments", icon: Repeat, to: "/app/analytics?tab=patterns", keywords: "subscriptions" },
  { id: "bills", group: "Actions", label: "Manage bill reminders", icon: ReceiptText, to: "/app/settings?tab=bills", keywords: "due pay" },
  { id: "prefs", group: "Actions", label: "Notification preferences", icon: BellRing, to: "/app/settings?tab=notifications", keywords: "alerts quiet hours thresholds" },
];

const pages: Command[] = navigation.flatMap((group) =>
  group.items.map((item) => ({
    id: `go-${item.to}`,
    group: "Go to" as const,
    label: item.label,
    icon: item.icon,
    to: item.to,
    hint: group.label,
    keywords: item.keywords,
  })),
);

function matches(command: Command, terms: string[]) {
  const haystack = `${command.label} ${command.keywords ?? ""} ${command.hint ?? ""}`.toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const text = query.trim();
    const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
    const found = [...actions, ...pages].filter((command) => matches(command, terms));
    if (!text) return found;
    const encoded = encodeURIComponent(text);
    const search: Command[] = [
      {
        id: "search-ledger",
        group: "Search",
        label: `Search transactions for “${text}”`,
        icon: Search,
        to: `/app/transactions?search=${encoded}`,
      },
      {
        id: "ask-assistant",
        group: "Search",
        label: `Ask the assistant: “${text}”`,
        icon: MessageSquareText,
        to: `/app/assistant?q=${encoded}`,
      },
    ];
    return [...found, ...search];
  }, [query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (command: Command | undefined) => {
    if (!command) return;
    onOpenChange(false);
    navigate(command.to);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(results.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[active]);
    }
  };

  let lastGroup = "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#02100c]/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-lift"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search or jump to</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search pages and actions, or type a question…"
              className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
              aria-autocomplete="list"
              maxLength={200}
            />
            <kbd className="hidden rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
              Esc
            </kbd>
          </div>

          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Results"
            className="max-h-[min(60vh,420px)] overflow-y-auto p-2"
          >
            {results.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No matches.</p>
            )}
            {results.map((command, index) => {
              const showGroup = command.group !== lastGroup;
              lastGroup = command.group;
              const Icon = command.icon;
              const selected = index === active;
              return (
                <div key={command.id}>
                  {showGroup && (
                    <p
                      className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground first:pt-1"
                      role="presentation"
                    >
                      {command.group}
                    </p>
                  )}
                  <div
                    id={`${listId}-${command.id}`}
                    role="option"
                    aria-selected={selected}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onClick={() => run(command)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                      selected ? "bg-primary/[0.07] text-foreground" : "text-foreground/85",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg border",
                        selected
                          ? "border-primary/20 bg-primary/10 text-primary"
                          : "border-border bg-secondary/60 text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{command.label}</span>
                    {command.hint && (
                      <span className="hidden text-[11px] text-muted-foreground sm:block">
                        {command.hint}
                      </span>
                    )}
                    {selected && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 border-t border-border bg-secondary/40 px-4 py-2 text-[10px] text-muted-foreground">
            <span>
              <kbd className="font-sans font-semibold">↑ ↓</kbd> to move
            </span>
            <span>
              <kbd className="font-sans font-semibold">Enter</kbd> to open
            </span>
            <span className="ml-auto hidden sm:inline">
              Press <kbd className="font-sans font-semibold">/</kbd> or{" "}
              <kbd className="font-sans font-semibold">Ctrl K</kbd> anywhere
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
