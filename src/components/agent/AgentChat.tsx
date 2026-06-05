"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, FilePlus, FileText, CheckCircle, AlertCircle, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AgentDocument } from "@/lib/types";

const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(?:password|passwd|pwd)\s*[:=]/i,
  /\b(?:api[_-]?key|secret[_-]?key|client[_-]?secret)\s*[:=]/i,
  /\b(?:auth[_-]?token|access[_-]?token|refresh[_-]?token)\s*[:=]/i,
  /\bsk-[a-zA-Z0-9]{20,}/,
  /\bghp_[a-zA-Z0-9]{36,}/,
  /\bgho_[a-zA-Z0-9]{36,}/,
  /\bAKIA[A-Z0-9]{16}/,
  /Bearer\s+[a-zA-Z0-9._-]{20,}/i,
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/,
  /\bxox[baprs]-[a-zA-Z0-9-]{20,}/,
];

function containsSensitive(text: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

const MAX_CHARS = 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActionProposal {
  type: "propose_document";
  document_id?: string;
  title: string;
  content: string;
  reason: string;
}

type ActionStatus = "pending" | "creating" | "done" | "error" | "dismissed";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: ActionProposal;
  actionStatus?: ActionStatus;
}

const SUGGESTED = [
  "Who are you?",
  "What are you building?",
  "What technologies do you use?",
  "Tell me about your projects",
  "What are your interests?",
];

interface AgentChatProps {
  username: string;
  displayName: string;
  /** Force visitor mode even when the session user is the profile owner (used on preview page). */
  preview?: boolean;
  /** Called after a proposed document is successfully created or updated. */
  onDocumentCreated?: (doc: AgentDocument) => void;
  /** Existing documents — used to resolve update vs create when the LLM omits document_id. Only provided in owner (studio) mode. */
  docs?: AgentDocument[];
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function AssistantMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        h1: ({ children }) => <h1 className="font-bold text-sm mb-1 mt-2 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="font-semibold text-sm mb-1 mt-2 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="font-medium text-sm mb-1 mt-1 first:mt-0">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-muted-foreground/30 pl-3 opacity-80 mb-2 italic">
            {children}
          </blockquote>
        ),
        pre: ({ children }) => (
          <pre className="bg-black/8 dark:bg-white/8 rounded-lg p-2.5 mb-2 overflow-x-auto text-xs font-mono">
            {children}
          </pre>
        ),
        code: ({ children, className }) =>
          className ? (
            <code className={`font-mono text-xs ${className}`}>{children}</code>
          ) : (
            <code className="bg-black/8 dark:bg-white/8 px-1 py-0.5 rounded text-xs font-mono">
              {children}
            </code>
          ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 opacity-80 hover:opacity-100"
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Action proposal card ─────────────────────────────────────────────────────

function ProposalCard({
  messageId,
  action,
  status,
  onApprove,
  onDismiss,
}: {
  messageId: string;
  action: ActionProposal;
  status: ActionStatus;
  onApprove: (messageId: string, action: ActionProposal) => void;
  onDismiss: (messageId: string) => void;
}) {
  const preview = action.content.slice(0, 280);
  const truncated = action.content.length > 280;

  return (
    <div className="mt-3 rounded-xl border border-violet-200 dark:border-violet-800/60 bg-violet-50/80 dark:bg-violet-950/30 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <FilePlus className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
          {action.document_id ? "Update document" : "Create document"}
        </span>
      </div>

      {/* Title */}
      <div className="flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <code className="text-xs font-mono font-medium text-foreground">{action.title}</code>
      </div>

      {/* Reason */}
      <p className="text-xs text-muted-foreground leading-relaxed">{action.reason}</p>

      {/* Content preview */}
      <pre className="text-[10px] leading-relaxed text-muted-foreground/80 font-mono bg-black/5 dark:bg-white/5 rounded-lg p-2.5 max-h-28 overflow-hidden whitespace-pre-wrap">
        {preview}{truncated ? "\n…" : ""}
      </pre>

      {/* Actions */}
      {status === "pending" && (
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={() => onApprove(messageId, action)}
            className="cursor-pointer flex-1 text-xs py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors font-medium"
          >
            {action.document_id ? "Update" : "Create"}
          </button>
          <button
            onClick={() => onDismiss(messageId)}
            className="cursor-pointer flex-1 text-xs py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {status === "creating" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
          <div className="w-3 h-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin flex-shrink-0" />
          {action.document_id ? "Updating document…" : "Creating document…"}
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 pt-0.5 font-medium">
          <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {action.document_id ? "Document updated" : "Document created"}
        </div>
      )}

      {status === "error" && (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {action.document_id ? "Failed to update. Try again?" : "Failed to create. Try again?"}
          </div>
          <button
            onClick={() => onApprove(messageId, action)}
            className="cursor-pointer text-xs text-violet-600 dark:text-violet-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {status === "dismissed" && (
        <p className="text-xs text-muted-foreground/50 pt-0.5">Dismissed</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AgentChat({ username, displayName, preview, onDocumentCreated, docs }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isAtBottom = useRef(true);
  const prevMessageCount = useRef(0);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const newMessageAdded = messages.length > prevMessageCount.current;
    prevMessageCount.current = messages.length;

    if (newMessageAdded) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      isAtBottom.current = true;
    } else if (isAtBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function resizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (e.target.value.length <= MAX_CHARS) {
      setInput(e.target.value);
      resizeTextarea();
    }
  }

  async function send(text: string) {
    const userText = text.trim();
    if (!userText || isStreaming || userText.length > MAX_CHARS) return;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: userText };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const historyForApi = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForApi, username, preview }),
      });

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + chunk.content } : m
                )
              );
            } else if (chunk.action?.type === "propose_document") {
              const incoming = chunk.action as ActionProposal;
              // Resolve missing document_id by matching title against known docs.
              // This handles the case where the LLM omits the ID even though the
              // document already exists (e.g. the file was open in the editor).
              if (!incoming.document_id && docs) {
                const match = docs.find(
                  (d) => d.title.toLowerCase() === incoming.title.toLowerCase()
                );
                if (match) incoming.document_id = match.id;
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, action: incoming, actionStatus: "pending" }
                    : m
                )
              );
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  async function approveAction(messageId: string, action: ActionProposal) {
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, actionStatus: "creating" } : m)
    );

    try {
      const isUpdate = !!action.document_id;
      const url = isUpdate
        ? `/api/agent/documents/${action.document_id}`
        : "/api/agent/documents";

      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        // For updates: only send title+content to preserve the document's existing
        // visibility, status, is_sensitive, and sort_order values.
        body: JSON.stringify(
          isUpdate
            ? { title: action.title, content: action.content }
            : { title: action.title, content: action.content, visibility: "public", status: "active", is_sensitive: false, sort_order: 100 }
        ),
      });

      if (!res.ok) throw new Error(isUpdate ? "Update failed" : "Create failed");
      const doc: AgentDocument = await res.json();

      fetch(`/api/agent/documents/${doc.id}/embed`, { method: "POST" }).catch(() => {});

      onDocumentCreated?.(doc);

      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, actionStatus: "done" } : m)
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === messageId ? { ...m, actionStatus: "error" } : m)
      );
    }
  }

  function dismissAction(messageId: string) {
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, actionStatus: "dismissed" } : m)
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const charsLeft = MAX_CHARS - input.length;
  const nearLimit = charsLeft <= 150;
  const showSuggested = messages.length === 0;
  const showSecurityWarning = docs !== undefined && containsSensitive(input);

  return (
    <div className="flex flex-col h-full">
      {/* Messages — flex col so empty state can fill with flex-1 */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0 flex flex-col"
      >
        {showSuggested ? (
          /* Empty / initial state — flex-1 centers it in the available space */
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 py-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/40">
              <Bot className="w-7 h-7 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Ask {displayName} anything</p>
              <p className="text-xs text-muted-foreground mt-1">Powered by their public knowledge</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-xs">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="cursor-pointer text-xs px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages list */
          <div className="flex flex-col gap-4 px-4 py-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center mt-0.5">
                    <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    msg.content === "" && !msg.action ? (
                      <span className="inline-flex gap-0.5 items-center py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                      </span>
                    ) : (
                      <>
                        {msg.content && <AssistantMessage content={msg.content} />}
                        {msg.action && msg.actionStatus && (
                          <ProposalCard
                            messageId={msg.id}
                            action={msg.action}
                            status={msg.actionStatus}
                            onApprove={approveAction}
                            onDismiss={dismissAction}
                          />
                        )}
                      </>
                    )
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input — unified floating container, no divider line */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        {showSecurityWarning && (
          <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/30 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            <span>Your message may contain a password, token, or secret. Anything saved to a public document can be read by anyone visiting your agent.</span>
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-border/70 bg-background shadow-sm px-3 py-2 focus-within:ring-2 focus-within:ring-violet-500/25 focus-within:border-violet-300 dark:focus-within:border-violet-700 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${displayName} anything…`}
            disabled={isStreaming}
            className="flex-1 resize-none bg-transparent py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50 overflow-hidden"
            style={{ minHeight: "36px", maxHeight: "160px" }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming || input.length > MAX_CHARS}
            className="cursor-pointer flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        {nearLimit && (
          <p className={`text-[11px] mt-1.5 text-right tabular-nums ${charsLeft <= 0 ? "text-red-500" : "text-muted-foreground"}`}>
            {charsLeft}
          </p>
        )}
      </div>
    </div>
  );
}
