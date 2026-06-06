"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { AGENT_TEMPLATES, CORE_TEMPLATES, type Template } from "@/lib/agent/templates";
import type { AgentDocument } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface SetupAssistantProps {
  docs: AgentDocument[];
  onUseTemplate: (title: string, content: string) => void;
  /** When true, only render the template checklist — no chat UI. */
  hideChatUI?: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function hasCoreDoc(docs: AgentDocument[], key: string): boolean {
  return docs.some((d) => d.title.toLowerCase().includes(key));
}

function TemplateCard({
  template,
  covered,
  onUse,
  useTemplateLabel,
}: {
  template: Template;
  covered: boolean;
  onUse: () => void;
  useTemplateLabel: string;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-start gap-3 transition-colors ${
        covered
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/50 dark:bg-emerald-950/20"
          : "border-border bg-muted/30 hover:bg-muted/50"
      }`}
    >
      <div className="mt-0.5 flex-shrink-0">
        {covered ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold font-mono text-foreground">{template.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed">{template.why}</p>
      </div>
      {!covered && (
        <button
          onClick={onUse}
          className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 mt-0.5 whitespace-nowrap transition-colors"
        >
          {useTemplateLabel}
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

export function SetupAssistant({ docs, onUseTemplate, hideChatUI }: SetupAssistantProps) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);
  const prevMessageCount = useRef(0);

  const coreTemplates = AGENT_TEMPLATES.filter((tmpl) =>
    (CORE_TEMPLATES as string[]).includes(tmpl.key)
  );
  const extraTemplates = AGENT_TEMPLATES.filter(
    (tmpl) => !(CORE_TEMPLATES as string[]).includes(tmpl.key)
  );

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

  async function send(text: string) {
    const userText = text.trim();
    if (!userText || isStreaming) return;
    setInput("");
    setStarted(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: userText };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const docSummaries = docs.map((d) => ({
        title: d.title,
        visibility: d.visibility,
        status: d.status,
      }));

      const historyForApi = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/agent/setup-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyForApi, docs: docSummaries }),
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
                  m.id === assistantId
                    ? { ...m, content: m.content + chunk.content }
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
            ? { ...m, content: t.agent.error }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && m.content === ""
            ? { ...m, content: t.agent.error }
            : m
        )
      );
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const completedCore = CORE_TEMPLATES.filter((k) =>
    hasCoreDoc(docs, k === "response-style" ? "response" : k)
  ).length;
  const progress = Math.round((completedCore / CORE_TEMPLATES.length) * 100);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Messages / initial panel */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0"
      >
        {/* Checklist — always visible at top */}
        <div className="space-y-3">
          {/* Progress */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              {t.agent.coreDocuments}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {completedCore}/{CORE_TEMPLATES.length}
            </span>
          </div>
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="space-y-2 pt-1">
            {coreTemplates.map((tmpl) => {
              const covered = hasCoreDoc(
                docs,
                tmpl.key === "response-style" ? "response" : tmpl.key
              );
              return (
                <TemplateCard
                  key={tmpl.key}
                  template={tmpl}
                  covered={covered}
                  onUse={() => onUseTemplate(tmpl.title, tmpl.content)}
                  useTemplateLabel={t.agent.useTemplate}
                />
              );
            })}
          </div>

          {/* Extra templates collapsed section */}
          {extraTemplates.length > 0 && (
            <div className="pt-2">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {t.agent.optional}
              </p>
              <div className="space-y-2">
                {extraTemplates.map((tmpl) => {
                  const covered = hasCoreDoc(docs, tmpl.key);
                  return (
                    <TemplateCard
                      key={tmpl.key}
                      template={tmpl}
                      covered={covered}
                      onUse={() => onUseTemplate(tmpl.title, tmpl.content)}
                      useTemplateLabel={t.agent.useTemplate}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Chat messages */}
        {!hideChatUI && messages.length > 0 && (
          <div className="pt-2 border-t border-border space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center mt-0.5">
                    <Sparkles className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm"
                      : "bg-muted text-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                  {msg.role === "assistant" && msg.content === "" && (
                    <span className="inline-flex gap-0.5 items-center">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                      <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                      <span className="w-1 h-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Suggested questions when chat is empty */}
        {!hideChatUI && !started && (
          <div className="pt-2 border-t border-border">
            <p className="text-[11px] text-muted-foreground mb-2">{t.agent.setupAskAnything}</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                t.agent.setupSuggest1,
                t.agent.setupSuggest2,
                t.agent.setupSuggest3,
                t.agent.setupSuggest4,
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/30 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Input — hidden when chat UI is disabled */}
      {!hideChatUI && (
        <div className="flex-shrink-0 border-t border-border px-4 py-3">
          <div className="flex gap-2 items-end">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.agent.setupPlaceholder}
              disabled={isStreaming}
              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-50 max-h-24 overflow-y-auto"
              style={{ minHeight: "40px" }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || isStreaming}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
