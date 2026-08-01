"use client";

import { useState } from "react";
import { Trash2, KeyRound } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

type Session = {
  id: string;
  name: string | null;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

function formatWhen(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function Sessions({ initial }: { initial: Session[] }) {
  const { t, locale } = useLanguage();
  const [sessions, setSessions] = useState(initial);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function revoke(id: string) {
    if (!window.confirm(t.mcp.sessionsRevokeConfirm)) return;
    setPendingId(id);
    try {
      const res = await fetch(`/api/mcp/tokens/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setPendingId(null);
    }
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t.mcp.sessionsEmpty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {sessions.map((s) => {
        const label = s.name || t.mcp.sessionDefaultName;
        const created = formatWhen(s.created_at, locale);
        const lastUsed = formatWhen(s.last_used_at, locale);
        const isPending = pendingId === s.id;

        return (
          <li key={s.id} className="flex items-start justify-between gap-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted/60">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{label}</p>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {s.token_prefix}…
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {created ? (
                    <span>{t.mcp.sessionsCreated.replace("{when}", created)}</span>
                  ) : null}
                  <span>
                    {lastUsed
                      ? t.mcp.sessionsLastUsed.replace("{when}", lastUsed)
                      : t.mcp.sessionsNeverUsed}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => revoke(s.id)}
              disabled={isPending}
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isPending ? t.mcp.sessionsRevoking : t.mcp.sessionsRevoke}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
