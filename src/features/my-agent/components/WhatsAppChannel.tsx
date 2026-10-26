"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Info, Phone, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { disconnectWhatsApp } from "../actions/agent-data";
import type { WhatsAppConnection } from "../types";
import { Section, fill, useMyAgentT } from "./shared";

// Channels → WhatsApp: the business's own number (Coexistence). Shows the real
// connection from whatsapp_connections, what the business agrees to and how
// customer data is handled, and lets the owner disconnect. Connecting needs
// Meta's Embedded Signup, which isn't built yet, so that button stays disabled.

type T = ReturnType<typeof useMyAgentT>["t"];

const META_TERMS = [
  { key: "linkWaTerms", href: "https://www.whatsapp.com/legal/business-terms" },
  { key: "linkWaPolicy", href: "https://business.whatsapp.com/policy" },
] as const;

const NANDZZ_TERMS = [
  { key: "linkTerms", href: "/terms" },
  { key: "linkPrivacy", href: "/privacy" },
  { key: "linkDpa", href: "/dpa" },
] as const;

const requirements = (w: T["whatsapp"]) => [w.req1, w.req2, w.req3];
const responsibilities = (w: T["whatsapp"]) => [w.resp1, w.resp2, w.resp3, w.resp4];
const dataHandling = (w: T["whatsapp"]) => [w.data1, w.data2, w.data3, w.data4];

export function WhatsAppChannel({ connection }: { connection: WhatsAppConnection | null }) {
  const { t } = useMyAgentT();
  const w = t.whatsapp;
  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/my-agent"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> {t.title}
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/15">
          <Phone aria-hidden className="h-5 w-5 text-[#128C7E]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{w.title}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", connection ? "bg-emerald-500" : "bg-muted-foreground/50")} />
            {connection ? `${w.connected}${connection.phone ? ` · ${connection.phone}` : ""}` : w.notConnected}
          </p>
        </div>
      </div>

      {connection ? <Connected connection={connection} /> : <NotConnected />}
    </div>
  );
}

function Connected({ connection }: { connection: WhatsAppConnection }) {
  const { t, locale } = useMyAgentT();
  const w = t.whatsapp;
  const date = new Date(connection.connectedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  return (
    <>
      <Section title={w.connectedTitle} description={w.connectedDesc}>
        <p className="text-sm text-muted-foreground">{fill(w.connectedOn, { date })}</p>
      </Section>

      <Section title={w.responsibilitiesTitle} description={w.responsibilitiesDesc}>
        <BulletList items={responsibilities(w)} />
        <LegalLinks />
      </Section>

      <Section title={w.dataTitle}>
        <BulletList items={dataHandling(w)} />
      </Section>

      <DisconnectSection />
    </>
  );
}

function NotConnected() {
  const { t } = useMyAgentT();
  const w = t.whatsapp;
  return (
    <>
      <Section title={w.connectTitle} description={w.connectDesc}>
        <ol className="mb-5 space-y-2 text-sm">
          {[w.step1, w.step2].map((step, i) => (
            <li key={step} className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button className="h-10 bg-[#25D366] text-[#073e2a] hover:bg-[#20bd5a]" disabled>
            <Phone aria-hidden /> {w.connectButton}
          </Button>
          <p className="text-xs text-muted-foreground">{w.connectUnavailable}</p>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{w.consent}</p>
      </Section>

      <Section title={w.beforeTitle}>
        <BulletList items={requirements(w)} />
      </Section>

      <Section title={w.agreeTitle}>
        <BulletList items={responsibilities(w)} />
        <div className="mt-4 border-t border-border/60 pt-4">
          <BulletList items={dataHandling(w)} />
        </div>
        <LegalLinks />
      </Section>
    </>
  );
}

function DisconnectSection() {
  const { t } = useMyAgentT();
  const w = t.whatsapp;
  const router = useRouter();
  const [deleteHistory, setDeleteHistory] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disconnect = async () => {
    setError(null);
    const res = await disconnectWhatsApp({ deleteHistory });
    if (!res.ok && res.error !== "NOT_FOUND") {
      setError(w.disconnectFailed);
      return;
    }
    router.refresh();
  };

  return (
    <Section
      title={w.disconnectTitle}
      description={w.disconnectDesc}
      className="border-destructive/30"
    >
      <label className="mb-4 flex cursor-pointer items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={deleteHistory}
          onChange={(e) => setDeleteHistory(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-destructive"
        />
        <span>
          {w.deleteHistory}
          <span className="block text-xs text-muted-foreground">{w.deleteHistoryHint}</span>
        </span>
      </label>
      <Button variant="destructive" className="h-10" onClick={() => setConfirming(true)}>
        <Unplug aria-hidden /> {w.disconnectButton}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={disconnect}
        title={w.confirmTitle}
        description={deleteHistory ? w.confirmBodyDelete : w.confirmBodyKeep}
        confirmLabel={w.disconnectButton}
        cancelLabel={t.cancel}
      />
    </Section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function LegalLinks() {
  const { t } = useMyAgentT();
  return (
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-border/60 pt-4 text-sm">
      {META_TERMS.map((l) => (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          {t.whatsapp[l.key]} <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </a>
      ))}
      {NANDZZ_TERMS.map((l) => (
        <Link key={l.href} href={l.href} className="font-medium underline-offset-4 hover:underline">
          {t.whatsapp[l.key]}
        </Link>
      ))}
    </div>
  );
}
