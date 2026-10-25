"use client";

import { useState } from "react";
import { Ban, Hand, MessagesSquare, Mic, Play, Smartphone, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationState } from "../types";
import { EmptyState, ResponsivePanel, Segmented, relativeTime } from "./shared";

// Assistance cards: one card per live conversation the agent is handling. This
// is deliberately NOT a chat client — there is no composer. The owner inspects
// the thread and can Stop the run, Suspend the agent for the chat, or Take over
// (the agent pauses and the owner continues from WhatsApp on the phone).

const STATE_META: Record<ConversationState, { label: string; dot: string }> = {
  handling: { label: "Agent replying", dot: "bg-emerald-500" },
  waiting: { label: "Waiting for you", dot: "bg-amber-500" },
  taken_over: { label: "You took over", dot: "bg-violet-500" },
  suspended: { label: "Agent off", dot: "bg-muted-foreground/50" },
};

type Filter = "live" | "suspended";

export function ConversationsTab({
  conversations: initial,
  now,
  takeoverMinutes,
}: {
  conversations: Conversation[];
  now: number;
  takeoverMinutes: number;
}) {
  const [conversations, setConversations] = useState(initial);
  const [filter, setFilter] = useState<Filter>("live");
  const [openId, setOpenId] = useState<string | null>(null);

  const live = conversations.filter((c) => c.state !== "suspended");
  const suspended = conversations.filter((c) => c.state === "suspended");
  const visible = filter === "live" ? live : suspended;
  const open = conversations.find((c) => c.id === openId) ?? null;

  // Placeholder actions: local state only until the runtime exposes controls.
  const setState = (id: string, state: ConversationState) => {
    setConversations((list) =>
      list.map((c) =>
        c.id === id
          ? {
              ...c,
              state,
              resumesAt: state === "taken_over" ? new Date(now + takeoverMinutes * 60_000).toISOString() : undefined,
            }
          : c,
      ),
    );
    setOpenId(null);
  };

  return (
    <div className="space-y-4">
      <Segmented
        ariaLabel="Filter conversations"
        value={filter}
        onChange={setFilter}
        size="sm"
        options={[
          { value: "live", label: "Live", count: live.length },
          { value: "suspended", label: "Agent off", count: suspended.length },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={filter === "live" ? "No live conversations" : "No chats with the agent off"}
          body={
            filter === "live"
              ? "When a customer writes on WhatsApp, the chat the agent is handling appears here."
              : "Chats where you switched the agent off are listed here so you can turn it back on."
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((c) => {
            const meta = STATE_META[c.state];
            const last = c.messages[c.messages.length - 1];
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(c.id)}
                  className="flex h-full w-full flex-col rounded-xl border border-border/60 bg-card p-4 text-left transition-[border-color,transform] duration-150 hover:border-border active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{c.customer}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{relativeTime(c.updatedAt, now)}</span>
                  </span>
                  <span className="mt-0.5 text-xs text-muted-foreground">
                    {c.intent} · {c.language}
                  </span>
                  <span className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{senderLabel(last.from)}: </span>
                    {last.voice ? `Voice note (${last.voice.seconds}s)` : last.text}
                  </span>
                  <span className="mt-auto flex items-center gap-1.5 pt-3 text-xs font-medium">
                    <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                    {c.state === "taken_over" && c.resumesAt && (
                      <span className="font-normal text-muted-foreground">· resumes {relativeTime(c.resumesAt, now)}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && (
        <ResponsivePanel
          open
          onClose={() => setOpenId(null)}
          title={open.customer}
          footer={<ConversationActions conversation={open} onChange={(s) => setState(open.id, s)} />}
        >
          <p className="mb-4 text-xs text-muted-foreground">
            {open.phone} · {open.intent} · {open.language}
          </p>
          <ol className="space-y-2">
            {open.messages.map((m) => (
              <li key={m.id} className={cn("flex", m.from === "customer" ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    m.from === "customer" && "rounded-bl-md bg-muted",
                    m.from === "agent" && "rounded-br-md bg-violet-600 text-white",
                    m.from === "owner" && "rounded-br-md bg-emerald-600 text-white",
                  )}
                >
                  {m.from !== "customer" && (
                    <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide opacity-80">
                      {m.from === "agent" ? "Agent" : "You"}
                    </span>
                  )}
                  {m.voice ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mic aria-hidden className="h-3.5 w-3.5" /> Voice note · {m.voice.seconds}s
                      <span className="text-muted-foreground">(transcribed)</span>
                    </span>
                  ) : (
                    m.text
                  )}
                  <span className="mt-1 block text-right text-[10px] tabular-nums opacity-70">{relativeTime(m.at, now)}</span>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Smartphone aria-hidden className="h-3.5 w-3.5" />
            Reply from WhatsApp on your phone — the agent pauses while you write.
          </p>
        </ResponsivePanel>
      )}
    </div>
  );
}

function senderLabel(from: "customer" | "agent" | "owner") {
  return from === "customer" ? "Customer" : from === "agent" ? "Agent" : "You";
}

function ConversationActions({
  conversation,
  onChange,
}: {
  conversation: Conversation;
  onChange: (state: ConversationState) => void;
}) {
  if (conversation.state === "suspended") {
    return (
      <Button className="h-10 w-full" onClick={() => onChange("handling")}>
        <Play aria-hidden /> Turn the agent back on
      </Button>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <Button variant="outline" className="h-10" onClick={() => onChange("waiting")} title="End the agent's current run">
        <Square aria-hidden /> Stop
      </Button>
      <Button variant="outline" className="h-10" onClick={() => onChange("suspended")} title="Switch the agent off for this chat">
        <Ban aria-hidden /> Suspend
      </Button>
      <Button
        className="h-10"
        disabled={conversation.state === "taken_over"}
        onClick={() => onChange("taken_over")}
        title="Pause the agent and continue on your phone"
      >
        <Hand aria-hidden /> Take over
      </Button>
    </div>
  );
}
