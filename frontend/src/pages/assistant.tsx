import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  MessageSquareText,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spin } from "@/components/ui/spin";
import { Textarea } from "@/components/ui/input";
import { useUrlAction } from "@/hooks/use-url-action";
import { api, ApiError } from "@/lib/api";
import type {
  AIStatus,
  ChatMessage,
  ChatResponse,
  ChatSession,
  ChatSessionDetail,
  ChatSource,
  EvidenceItem,
} from "@/lib/types";
import {
  appHref,
  cn,
  formatRelative,
  parseStoredJson,
} from "@/lib/utils";

interface UiMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  evidence?: EvidenceItem[];
  sources?: ChatSource[];
  model?: string | null;
  mode?: string | null;
  providerFallback?: boolean;
  limitations?: string[];
  createdAt?: string;
}

const fallbackSuggestions = [
  "How much did I spend on Food & Dining this month?",
  "Which of my budgets are at risk of going over?",
  "Where is most of my money going this month?",
  "Explain how an emergency fund should work.",
];

function fromMessage(message: ChatMessage): UiMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    evidence: parseStoredJson<EvidenceItem[]>(message.evidence_json) ?? [],
    sources: parseStoredJson<ChatSource[]>(message.sources_json) ?? [],
    model: message.model,
    mode: message.mode,
    providerFallback: message.provider_fallback,
    createdAt: message.created_at,
  };
}

function AnswerText({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: Array<{ type: "paragraph" | "list"; lines: string[] }> = [];
  let current: { type: "paragraph" | "list"; lines: string[] } | null = null;

  for (const line of lines) {
    const isList = /^\s*[-•]\s+/.test(line);
    const type = isList ? "list" : "paragraph";
    if (!current || current.type !== type) {
      current = { type, lines: [] };
      blocks.push(current);
    }
    if (line.trim()) current.lines.push(isList ? line.replace(/^\s*[-•]\s+/, "") : line);
  }

  return (
    <div className="space-y-2.5">
      {blocks.map((block, index) =>
        block.type === "list" ? (
          <ul key={index} className="space-y-1.5 pl-0.5">
            {block.lines.map((line, lineIndex) => (
              <li
                key={lineIndex}
                className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground/80"
              >
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/50" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p
            key={index}
            className="whitespace-pre-wrap text-[12px] leading-[1.75] text-foreground/85"
          >
            {block.lines.join("\n")}
          </p>
        ),
      )}
    </div>
  );
}

function EvidencePanel({
  evidence,
  sources,
  fallback,
  limitations,
  model,
}: {
  evidence?: EvidenceItem[];
  sources?: ChatSource[];
  fallback?: boolean;
  limitations?: string[];
  model?: string | null;
}) {
  return (
    <div className="mt-3 space-y-2">
      {fallback && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-800">
          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
          The hosted AI provider was unavailable. This is a deterministic grounded answer calculated
          directly from your records.
        </div>
      )}

      {evidence && evidence.length > 0 && (
        <details className="group rounded-lg border border-border/70 bg-background/50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground">
            <CheckCircle2 className="size-3 text-emerald-600" />
            {evidence.length} evidence item{evidence.length === 1 ? "" : "s"}
            <span className="ml-auto transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="grid gap-1.5 border-t border-border/60 p-2 sm:grid-cols-2">
            {evidence.map((item) => {
              const content = (
                <>
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold">{item.value}</p>
                  <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{item.source}</p>
                </>
              );
              return item.route ? (
                <Link
                  key={item.id}
                  to={appHref(item.route)}
                  className="rounded-lg border border-border/60 bg-card p-2 transition-colors hover:border-primary/25"
                >
                  {content}
                  <span className="mt-1 inline-flex items-center gap-0.5 text-[9px] font-semibold text-primary">
                    Open source <ArrowUpRight className="size-2.5" />
                  </span>
                </Link>
              ) : (
                <div key={item.id} className="rounded-lg border border-border/60 bg-card p-2">
                  {content}
                </div>
              );
            })}
          </div>
        </details>
      )}

      {sources && sources.length > 0 && (
        <details className="group rounded-lg border border-border/70 bg-background/50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[10px] font-semibold text-muted-foreground">
            <BookOpen className="size-3 text-sky-600" />
            {sources.length} knowledge source{sources.length === 1 ? "" : "s"}
            <span className="ml-auto transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="space-y-1.5 border-t border-border/60 p-2">
            {sources.map((source) => (
              <div key={source.chunk_id} className="rounded-lg bg-card p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold">{source.title}</p>
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[8px] text-muted-foreground">
                    {Math.round(source.similarity * 100)}% match
                  </span>
                </div>
                <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
                  {source.snippet}
                </p>
                <p className="mt-1 text-[8px] text-muted-foreground/60">{source.source}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {limitations && limitations.length > 0 && (
        <p className="px-1 text-[9px] leading-relaxed text-muted-foreground">
          {limitations.join(" ")}
        </p>
      )}
      {model && (
        <p className="px-1 text-[8px] text-muted-foreground/60">Generated with {model}</p>
      )}
    </div>
  );
}

export default function AssistantPage() {
  const queryClient = useQueryClient();
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [deleting, setDeleting] = useState<ChatSession | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessionsQuery = useQuery({
    queryKey: ["ai", "sessions"],
    queryFn: () => api.get<ChatSession[]>("/ai/sessions"),
  });

  const statusQuery = useQuery({
    queryKey: ["ai", "status"],
    queryFn: () => api.get<AIStatus>("/ai/status"),
    staleTime: 5 * 60 * 1000,
  });

  const suggestionsQuery = useQuery({
    queryKey: ["ai", "suggestions"],
    queryFn: () => api.get<string[]>("/ai/suggestions"),
    staleTime: 30 * 60 * 1000,
  });

  const suggestions =
    suggestionsQuery.data && suggestionsQuery.data.length > 0
      ? suggestionsQuery.data.slice(0, 4)
      : fallbackSuggestions;

  useEffect(() => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    }
  }, [messages, chatError]);

  const loadSession = async (id: number) => {
    setHistoryLoading(true);
    setChatError("");
    try {
      const detail = await api.get<ChatSessionDetail>(`/ai/sessions/${id}`);
      setCurrentSessionId(detail.id);
      setMessages(detail.messages.map(fromMessage));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not open that conversation");
    } finally {
      setHistoryLoading(false);
    }
  };

  const sendMutation = useMutation({
    mutationFn: (text: string) =>
      api.post<ChatResponse>("/ai/chat", {
        message: text,
        session_id: currentSessionId,
      }),
    onSuccess: (response, text) => {
      setCurrentSessionId(response.session_id);
      setMessages((current) => [
        ...current,
        {
          id: response.message_id,
          role: "assistant",
          content: response.answer,
          evidence: response.evidence,
          sources: response.sources,
          model: response.model,
          mode: response.mode,
          providerFallback: response.provider_fallback,
          limitations: response.limitations,
        },
      ]);
      setChatError("");
      void queryClient.invalidateQueries({ queryKey: ["ai", "sessions"] });
      if (!currentSessionId) {
        setInput((current) => (current === text ? "" : current));
      }
    },
    onError: (error) => {
      setChatError(
        error instanceof ApiError ? error.message : "The assistant could not answer. Try again.",
      );
    },
  });

  const send = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || sendMutation.isPending) return;
    setChatError("");
    setMessages((current) => [
      ...current,
      {
        id: -Date.now(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput("");
    sendMutation.mutate(text);
  };

  // `/app/assistant?q=...` (used by the command palette) asks immediately.
  useUrlAction("q", (question) => {
    if (question.trim()) send(question.slice(0, 1000));
  });

  const startNew = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setInput("");
    setChatError("");
  };

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/ai/sessions/${id}`),
    onSuccess: (_, id) => {
      toast.success("Conversation deleted");
      if (id === currentSessionId) startNew();
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["ai", "sessions"] });
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Could not delete the conversation"),
  });

  const status = statusQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
            <ShieldCheck className="size-3" />
            Grounded mode
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">AI assistant</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Ask about your money. Answers are calculated from your records first, with evidence you
            can inspect — or a clear refusal when the data isn’t there.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={startNew}>
          <Plus className="size-3.5" />
          New conversation
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[248px_1fr]">
        <div className="space-y-3">
          <Card className="p-2">
            <div className="flex items-center justify-between px-2 py-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Recent
              </p>
              <span className="text-[9px] text-muted-foreground/60">
                {sessionsQuery.data?.length ?? 0}
              </span>
            </div>
            <div className="space-y-0.5 lg:max-h-[330px] lg:overflow-y-auto">
              {sessionsQuery.isLoading ? (
                <div className="space-y-1 p-1">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 rounded-lg" />
                  ))}
                </div>
              ) : !sessionsQuery.data?.length ? (
                <p className="px-2 py-6 text-center text-[10px] leading-relaxed text-muted-foreground">
                  Conversations appear here after your first question.
                </p>
              ) : (
                sessionsQuery.data.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-lg transition-colors",
                      currentSessionId === session.id
                        ? "bg-primary/5"
                        : "hover:bg-secondary/60",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => loadSession(session.id)}
                      className="min-w-0 flex-1 px-2.5 py-2.5 text-left"
                    >
                      <p
                        className={cn(
                          "truncate text-[11px] font-semibold",
                          currentSessionId === session.id && "text-primary",
                        )}
                      >
                        {session.title}
                      </p>
                      <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                        {session.preview ?? "No messages"} · {formatRelative(session.updated_at)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(session)}
                      className="mr-1 rounded p-1.5 text-muted-foreground/50 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                      aria-label="Delete conversation"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="hidden p-4 lg:block">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <Sparkles className="size-3.5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold">
                  {status ? status.provider.replaceAll("_", " ") : "Assistant status"}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {status?.configured ? "Provider configured" : "Local grounded mode"}
                </p>
              </div>
            </div>
            <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
              {status?.note ??
                "FinSight calculates financial facts first. Language generation is optional."}
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[9px] text-muted-foreground">
              <CheckCircle2 className="size-3 text-emerald-600" />
              Evidence linked to its source
            </div>
          </Card>
        </div>

        <Card className="flex min-h-[620px] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <BrandMark className="size-8 rounded-lg" />
              <div>
                <p className="text-xs font-semibold">FinSight assistant</p>
                <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Grounded in your records
                </p>
              </div>
            </div>
            <div className="lg:hidden">
              <Select
                value={currentSessionId ? String(currentSessionId) : ""}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value) void loadSession(Number(value));
                  else startNew();
                }}
                className="h-8 w-[150px] text-[10px]"
                aria-label="Conversation history"
              >
                <option value="">New conversation</option>
                {(sessionsQuery.data ?? []).map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </Select>
            </div>
            <span className="hidden rounded-md border border-border px-2 py-1 text-[9px] font-medium text-muted-foreground sm:block">
              {status?.model ?? "deterministic"}
            </span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-background/50 to-card px-4 py-5 sm:px-6">
            {historyLoading ? (
              <div className="space-y-4">
                <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
                <Skeleton className="h-36 w-4/5 rounded-2xl" />
              </div>
            ) : messages.length === 0 ? (
              <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-10 text-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-emerald-300/30 blur-xl" />
                  <div className="relative grid size-12 place-items-center rounded-2xl bg-[#071a16] text-emerald-300 shadow-lift">
                    <Sparkles className="size-5" />
                  </div>
                </div>
                <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
                  What would you like to understand?
                </h2>
                <p className="mt-1.5 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                  I can calculate spending, compare budgets, explain goals, check recurring
                  payments, or work through a scenario.
                </p>
                <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => send(suggestion)}
                      className="rounded-xl border border-border bg-card p-3 text-left text-[10px] leading-relaxed text-foreground/75 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-soft"
                    >
                      {suggestion}
                      <ArrowUpRight className="ml-auto mt-1.5 block size-3 text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) =>
                  message.role === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[86%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[12px] leading-relaxed text-primary-foreground shadow-sm">
                        {message.content}
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className="flex gap-2.5">
                      <BrandMark className="mt-0.5 size-7 shrink-0 rounded-lg" />
                      <div className="min-w-0 max-w-[92%] flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                            FinSight
                          </p>
                          {message.mode && (
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[8px] font-medium capitalize text-muted-foreground">
                              {message.mode}
                            </span>
                          )}
                        </div>
                        <div className="mt-1.5 rounded-2xl rounded-tl-md border border-border/70 bg-card px-4 py-3 shadow-sm">
                          <AnswerText content={message.content} />
                          <EvidencePanel
                            evidence={message.evidence}
                            sources={message.sources}
                            fallback={message.providerFallback}
                            limitations={message.limitations}
                            model={message.model}
                          />
                        </div>
                      </div>
                    </div>
                  ),
                )}
                {sendMutation.isPending && (
                  <div className="flex gap-2.5">
                    <BrandMark className="mt-0.5 size-7 shrink-0 rounded-lg" />
                    <div className="rounded-2xl rounded-tl-md border border-border/70 bg-card px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="flex gap-1">
                          <span className="size-1.5 animate-pulse rounded-full bg-primary/60" />
                          <span className="size-1.5 animate-pulse rounded-full bg-primary/60 [animation-delay:150ms]" />
                          <span className="size-1.5 animate-pulse rounded-full bg-primary/60 [animation-delay:300ms]" />
                        </span>
                        Reading budgets, transactions, and goals…
                      </div>
                    </div>
                  </div>
                )}
                {chatError && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-rose-600" />
                    <div>
                      <p className="text-[10px] font-semibold text-rose-800">
                        The assistant couldn’t answer
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-rose-700">{chatError}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border/70 bg-card p-3 sm:p-4">
            <div className="rounded-xl border border-input bg-background/30 p-1.5 transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask about spending, budgets, goals, recurring payments…"
                maxLength={2000}
                rows={2}
                disabled={sendMutation.isPending}
                className="min-h-[52px] resize-none border-0 bg-transparent px-2.5 py-2 shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
              <div className="flex items-center justify-between gap-2 px-1.5 pb-1">
                <p className="text-[9px] text-muted-foreground">
                  Enter to send · Shift+Enter for a new line
                </p>
                <Button
                  size="icon-sm"
                  onClick={() => send()}
                  disabled={!input.trim() || sendMutation.isPending}
                  aria-label="Send message"
                >
                  {sendMutation.isPending ? <Spin /> : <Send className="size-3.5" />}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-center text-[8px] leading-relaxed text-muted-foreground">
              FinSight can make mistakes. Verify important figures. It does not provide regulated
              financial advice or execute payments.
            </p>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: "Calculated first",
            body: "Facts are computed from your ledger before any language model is involved.",
          },
          {
            icon: MessageSquareText,
            title: "Evidence attached",
            body: "Open the evidence and source panels to see exactly what the answer used.",
          },
          {
            icon: AlertCircle,
            title: "Refusal is a feature",
            body: "If the records do not support an answer, the assistant says so instead of guessing.",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="flex gap-3 rounded-xl border border-border bg-card/60 p-4">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-[11px] font-semibold">{item.title}</p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this conversation?"
        description={
          deleting
            ? `“${deleting.title}” and all of its messages will be removed.`
            : ""
        }
        confirmLabel="Delete conversation"
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
