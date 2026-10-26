"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare, Mic, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { deleteConversation } from "../actions/agent-data";
import type { Conversation, ConversationState } from "../types";
import { EmptyState, ResponsivePanel, Segmented, relativeTime } from "./shared";

// Assistance cards: one card per WhatsApp chat the agent has handled. This is
// deliberately NOT a chat client — there is no composer. The owner inspects the
// thread and replies from WhatsApp on the phone (the agent pauses meanwhile).

const STATE_META: Record<ConversationState, { label: string; dot: string }> = {
  handling: { label: "Agent replying", dot: "bg-emerald-500" },
  handed_off: { label: "Handed off to you", dot: "bg-amber-500" },
  taken_over: { label: "You took over", dot: "bg-violet-500" },
};

type Filter = "all" | "handed_off";

export function ConversationsTab({ conversations: initial, now }: { conversations: Conversation[]; now: number }) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handedOff = conversations.filter((c) => c.state === "handed_off");
  const visible = filter === "all" ? conversations : handedOff;
  const open = conversations.find((c) => c.id === openId) ?? null;

  const remove = async (id: string) => {
    setError(null);
    const res = await deleteConversation(id);
    if (!res.ok && res.error !== "NOT_FOUND") {
      setError("Couldn't delete this conversation. Please try again.");
      return;
    }
    setConversations((list) => list.filter((c) => c.id !== id));
    setOpenId(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <Segmented
        ariaLabel="Filter conversations"
        value={filter}
        onChange={setFilter}
        size="sm"
        options={[
          { value: "all", label: "All", count: conversations.length },
          { value: "handed_off", label: "Handed off", count: handedOff.length },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={filter === "all" ? "No conversations yet" : "Nothing handed off"}
          body={
            filter === "all"
              ? "When a customer writes on WhatsApp, the chat the agent is handling appears here."
              : "Chats the agent passes to you (complaints, refunds, questions it can't answer) are listed here."
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
                  <span className="mt-0.5 text-xs text-muted-foreground">{c.phone}</span>
                  <span className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{senderLabel(last.from)}: </span>
                    {last.text}
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
          footer={
            <Button
              variant="ghost"
              className="h-10 w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 aria-hidden /> Delete conversation
            </Button>
          }
        >
          <p className="mb-4 text-xs text-muted-foreground">
            {open.phone} · {STATE_META[open.state].label}
          </p>
          <ol className="space-y-2">
            {open.messages.map((m) => (
              <li key={m.id} className={cn("flex", m.from === "customer" ? "justify-start" : "justify-end")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
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
                  {m.voice && (
                    <span className="mb-0.5 flex items-center gap-1 text-xs opacity-80">
                      <Mic aria-hidden className="h-3.5 w-3.5" /> Voice note (transcribed)
                    </span>
                  )}
                  {m.text}
                  <span className="mt-1 block text-right text-[10px] tabular-nums opacity-70">{relativeTime(m.at, now)}</span>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Smartphone aria-hidden className="h-3.5 w-3.5" />
            Reply from WhatsApp on your phone — the agent pauses while you write.
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </ResponsivePanel>
      )}

      <ConfirmDialog
        open={confirmDelete && !!open}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => (open ? remove(open.id) : undefined)}
        title="Delete this conversation?"
        description="All its messages, activity and open requests are deleted from Nandzz for good, and the agent forgets the chat. Bookings stay in your calendar, and the chat stays in the WhatsApp Business app on your phone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}

function senderLabel(from: "customer" | "agent" | "owner") {
  return from === "customer" ? "Customer" : from === "agent" ? "Agent" : "You";
}
