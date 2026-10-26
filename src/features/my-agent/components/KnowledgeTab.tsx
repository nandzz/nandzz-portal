"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, History, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteKnowledgeEntry, saveKnowledgeEntry } from "../actions/agent-settings";
import type { KnowledgeEntry } from "../types";
import { EmptyState, ResponsivePanel, Section, relativeTime } from "./shared";

// Knowledge = the owner's entries the agent searches before answering
// (agent_knowledge) + what it learned from imported WhatsApp history. The
// "learned" part is placeholder content until the history import exists.

const LEARNED = {
  faqs: [
    { q: "Do you take walk-ins?", a: "Only on weekday mornings, otherwise by appointment." },
    { q: "How much is a haircut?", a: "From 25 €; with styling 35 €." },
    { q: "Is there parking?", a: "Free parking behind the building after 18:00." },
  ],
  tone: ["Friendly", "Informal (tu)", "Short replies", "Emoji sometimes"],
};

const TITLE_MAX = 200;
const BODY_MAX = 8000;

type Editing = { id?: string; title: string; body: string };

export function KnowledgeTab({ entries, now }: { entries: KnowledgeEntry[]; now: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const open = (entry?: KnowledgeEntry) => {
    setError(null);
    setEditing(entry ? { id: entry.id, title: entry.title, body: entry.body } : { title: "", body: "" });
  };

  const save = () => {
    if (!editing) return;
    startSaving(async () => {
      const res = await saveKnowledgeEntry(editing);
      if (!res.ok) {
        setError(
          res.error === "TOO_MANY"
            ? "You've reached the maximum number of entries. Merge or delete some first."
            : res.error === "INVALID_INPUT"
              ? "Add a title and some content."
              : "Couldn't save. Please try again.",
        );
        return;
      }
      setEditing(null);
      router.refresh();
    });
  };

  const remove = async () => {
    if (!deleting) return;
    setListError(null);
    const res = await deleteKnowledgeEntry(deleting.id);
    if (res.ok) router.refresh();
    else setListError("Couldn't delete that entry. Please try again.");
  };

  const canSave = !!editing && editing.title.trim().length > 0 && editing.body.trim().length > 0;

  return (
    <div className="space-y-4">
      <Section
        title="What the agent knows"
        description="Prices, policies, opening details, FAQs. The agent looks here before answering and never makes things up."
        action={
          entries.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => open()}>
              <Plus aria-hidden /> Add
            </Button>
          )
        }
      >
        {entries.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={BookOpen}
              title="Nothing here yet"
              body="Add what customers usually ask about: prices, parking, payment methods, cancellation policy."
            />
            <div className="flex justify-center">
              <Button size="sm" onClick={() => open()}>
                <Plus aria-hidden /> Add your first entry
              </Button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {entries.map((e) => (
              <li key={e.id} className="group flex items-start gap-3 px-3 py-2.5">
                <button type="button" onClick={() => open(e)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{e.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">Updated {relativeTime(e.updatedAt, now)}</p>
                </button>
                <div className="flex shrink-0 gap-0.5">
                  <Button size="icon-sm" variant="ghost" onClick={() => open(e)} aria-label={`Edit ${e.title}`}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setDeleting(e)} aria-label={`Delete ${e.title}`}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {listError && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {listError}
          </p>
        )}
      </Section>

      <Section
        title="Learned from your chats"
        description="Built once from up to 180 days of WhatsApp history after you connect."
        action={<History aria-hidden className="h-4 w-4 text-muted-foreground" />}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Frequent questions</p>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {LEARNED.faqs.map((f) => (
                <li key={f.q} className="flex gap-3 px-3 py-2.5">
                  <MessageCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{f.q}</p>
                    <p className="text-muted-foreground">{f.a}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your tone</p>
            <div className="flex flex-wrap gap-1.5">
              {LEARNED.tone.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Sample content — the real list appears after the history import.</p>
        </div>
      </Section>

      <ResponsivePanel
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? "Edit entry" : "New entry"}
        footer={
          <div className="flex items-center justify-end gap-2">
            {error && (
              <p role="alert" className="mr-auto text-sm text-destructive">
                {error}
              </p>
            )}
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !canSave}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="knowledge-title">Title</Label>
              <Input
                id="knowledge-title"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                maxLength={TITLE_MAX}
                placeholder="e.g. Prices"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="knowledge-body">Content</Label>
              <Textarea
                id="knowledge-body"
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                maxLength={BODY_MAX}
                rows={10}
                placeholder="Write it the way you'd explain it to a new colleague."
              />
              <p className="text-right text-[11px] tabular-nums text-muted-foreground">
                {editing.body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </ResponsivePanel>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete this entry?"
        description={deleting ? `The agent will no longer know “${deleting.title}”.` : undefined}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </div>
  );
}
