"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteKnowledgeEntry, saveKnowledgeEntry } from "../actions/agent-settings";
import type { KnowledgeEntry } from "../types";
import { EmptyState, ResponsivePanel, Section, fill, relativeTime, useMyAgentT } from "./shared";

// Knowledge = the owner's entries the agent searches before answering
// (agent_knowledge).

const TITLE_MAX = 200;
const BODY_MAX = 8000;

const SAVE_ERROR: Record<string, "tooMany" | "invalid" | undefined> = { TOO_MANY: "tooMany", INVALID_INPUT: "invalid" };

type Editing = { id?: string; title: string; body: string };

export function KnowledgeTab({ entries, now }: { entries: KnowledgeEntry[]; now: number }) {
  const { t: m, locale } = useMyAgentT();
  const t = m.knowledge;
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
        setError(t[SAVE_ERROR[res.error] ?? "saveFailed"]);
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
    else setListError(t.deleteFailed);
  };

  const canSave = !!editing && editing.title.trim().length > 0 && editing.body.trim().length > 0;

  return (
    <div className="space-y-4">
      <Section
        title={t.title}
        description={t.description}
        action={
          entries.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => open()}>
              <Plus aria-hidden /> {t.add}
            </Button>
          )
        }
      >
        {entries.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={BookOpen}
              title={t.emptyTitle}
              body={t.emptyBody}
            />
            <div className="flex justify-center">
              <Button size="sm" onClick={() => open()}>
                <Plus aria-hidden /> {t.addFirst}
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
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">{fill(t.updated, { time: relativeTime(e.updatedAt, now, locale) })}</p>
                </button>
                <div className="flex shrink-0 gap-0.5">
                  <Button size="icon-sm" variant="ghost" onClick={() => open(e)} aria-label={fill(t.editAria, { title: e.title })}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button size="icon-sm" variant="ghost" onClick={() => setDeleting(e)} aria-label={fill(t.deleteAria, { title: e.title })}>
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

      <ResponsivePanel
        open={editing !== null}
        onClose={() => !saving && setEditing(null)}
        title={editing?.id ? t.editTitle : t.newTitle}
        footer={
          <div className="flex items-center justify-end gap-2">
            {error && (
              <p role="alert" className="mr-auto text-sm text-destructive">
                {error}
              </p>
            )}
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              {m.cancel}
            </Button>
            <Button onClick={save} disabled={saving || !canSave}>
              {saving ? m.saving : m.save}
            </Button>
          </div>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="knowledge-title">{t.fieldTitle}</Label>
              <Input
                id="knowledge-title"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                maxLength={TITLE_MAX}
                placeholder={t.titlePlaceholder}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="knowledge-body">{t.fieldContent}</Label>
              <Textarea
                id="knowledge-body"
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                maxLength={BODY_MAX}
                rows={10}
                placeholder={t.contentPlaceholder}
              />
              <p className="text-right text-[11px] tabular-nums text-muted-foreground">
                {editing.body.length.toLocaleString(locale)} / {BODY_MAX.toLocaleString(locale)}
              </p>
            </div>
          </div>
        )}
      </ResponsivePanel>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={t.deleteTitle}
        description={deleting ? fill(t.deleteBody, { title: deleting.title }) : undefined}
        confirmLabel={m.delete}
        cancelLabel={m.cancel}
      />
    </div>
  );
}
