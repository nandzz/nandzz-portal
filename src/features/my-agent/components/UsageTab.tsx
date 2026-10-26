"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import type { UsageSummary } from "../types";
import { Meter, Section, fill, useMyAgentT } from "./shared";

// Meta delivers this many agent replies per number per month without a card.
const META_FREE_REPLIES = 1_000;

export function UsageTab({ usage }: { usage: UsageSummary }) {
  const { t: m, locale } = useMyAgentT();
  const t = m.usage;
  const fmt = (n: number) => n.toLocaleString(locale);
  const { inbound, replies, daily } = usage;
  const metaRatio = replies / META_FREE_REPLIES;
  const peak = Math.max(...daily, 1);

  return (
    <div className="space-y-4">
      <Section title={t.servedTitle} description={fill(t.servedDesc, { period: usage.periodLabel })}>
        <p className="mb-2 text-2xl font-semibold tabular-nums">{fmt(inbound + replies)}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: t.inbound, value: inbound },
            { label: t.replies, value: replies },
          ].map((b) => (
            <div key={b.label} className="rounded-lg bg-muted/60 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{b.label}</dt>
              <dd className="text-sm font-semibold tabular-nums">{fmt(b.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{t.ownNote}</p>
      </Section>

      <Section title={t.last14Title} description={t.last14Desc}>
        <div className="flex h-24 items-end gap-1" role="img" aria-label={`${t.last14Desc} · ${t.last14Title}`}>
          {daily.map((v, i) => (
            <div key={i} className="flex-1 rounded-t bg-violet-600/80" style={{ height: `${(v / peak) * 100}%` }} title={`${v}`} />
          ))}
        </div>
      </Section>

      <Section title={t.freeTitle} description={t.freeDesc}>
        <p className="mb-2 text-sm tabular-nums">
          <span className="font-semibold">{fmt(replies)}</span>
          <span className="text-muted-foreground"> {fill(t.used, { max: fmt(META_FREE_REPLIES) })}</span>
        </p>
        <Meter value={replies} max={META_FREE_REPLIES} />
        {metaRatio >= 0.8 && (
          <div className="mt-3 flex gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/30">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0">
              <p className="font-medium">{t.capTitle}</p>
              <p className="mt-0.5 text-muted-foreground">{t.capBody}</p>
              <a
                href="https://business.facebook.com/wa/manage/"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:underline"
              >
                {t.openManager} <ExternalLink aria-hidden className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
