"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContentReport } from "../actions/submit-report";
import type { LegalLocale } from "../locale";
import { REPORT_REASONS, type ReportReason } from "../schemas";

const COPY = {
  en: {
    url: "URL of the content",
    reason: "Reason",
    details: "Explain why the content is illegal or breaks our policies",
    detailsHint: "Be as precise as possible: what, where on the page, and which law or rule it breaks.",
    name: "Your name (optional)",
    email: "Your email (optional — needed to receive our decision)",
    goodFaith:
      "I confirm, in good faith, that the information and allegations in this notice are accurate and complete.",
    submit: "Send report",
    sending: "Sending…",
    done: "Thank you — your report was received.",
    ref: "Reference",
    errors: {
      INVALID_INPUT: "Please check the fields: a valid URL, a reason and at least a short explanation are required.",
      RATE_LIMITED: "Too many reports from this connection. Please try again later or email us.",
      FAILED: "Something went wrong. Please try again or email us.",
    },
    reasons: {
      illegal: "Illegal content (other)",
      csam: "Child sexual abuse material",
      ip: "Intellectual property (copyright, trademark)",
      privacy: "Privacy / personal data",
      hate: "Hate speech or harassment",
      violence: "Violence, threats or terrorism",
      fraud: "Fraud, scam or phishing",
      malware: "Malware or security threat",
      impersonation: "Impersonation",
      other: "Breaks Nandzz policies (other)",
    } satisfies Record<ReportReason, string>,
  },
  it: {
    url: "URL del contenuto",
    reason: "Motivo",
    details: "Spiega perché il contenuto è illecito o viola le nostre policy",
    detailsHint: "Sii il più preciso possibile: cosa, in quale punto della pagina e quale norma o regola viola.",
    name: "Il tuo nome (facoltativo)",
    email: "La tua email (facoltativa — serve per ricevere la nostra decisione)",
    goodFaith:
      "Dichiaro in buona fede che le informazioni e le affermazioni contenute in questa segnalazione sono esatte e complete.",
    submit: "Invia segnalazione",
    sending: "Invio…",
    done: "Grazie — abbiamo ricevuto la tua segnalazione.",
    ref: "Riferimento",
    errors: {
      INVALID_INPUT: "Controlla i campi: servono un URL valido, un motivo e almeno una breve spiegazione.",
      RATE_LIMITED: "Troppe segnalazioni da questa connessione. Riprova più tardi o scrivici via email.",
      FAILED: "Si è verificato un errore. Riprova o scrivici via email.",
    },
    reasons: {
      illegal: "Contenuto illecito (altro)",
      csam: "Materiale pedopornografico",
      ip: "Proprietà intellettuale (diritto d'autore, marchi)",
      privacy: "Privacy / dati personali",
      hate: "Incitamento all'odio o molestie",
      violence: "Violenza, minacce o terrorismo",
      fraud: "Frode, truffa o phishing",
      malware: "Malware o minaccia alla sicurezza",
      impersonation: "Furto d'identità",
      other: "Viola le policy di Nandzz (altro)",
    } satisfies Record<ReportReason, string>,
  },
} as const;

export function ReportContentForm({ locale, initialUrl }: { locale: LegalLocale; initialUrl?: string }) {
  const c = COPY[locale];
  const [url, setUrl] = useState(initialUrl ?? "");
  const [reason, setReason] = useState<ReportReason>("illegal");
  const [details, setDetails] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [goodFaith, setGoodFaith] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState<string | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goodFaith) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await submitContentReport({ url, reason, details, name, email, goodFaith: true });
      if (res.ok) setDoneId(res.id);
      else setError(c.errors[res.error]);
    } catch {
      setError(c.errors.FAILED);
    } finally {
      setStatus("idle");
    }
  }

  if (doneId) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">{c.done}</p>
          <p className="mt-1 text-sm opacity-80">
            {c.ref}: <code>{doneId}</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border bg-card p-6 text-foreground">
      <div className="space-y-1.5">
        <Label htmlFor="report-url">{c.url}</Label>
        <Input
          id="report-url"
          type="url"
          required
          placeholder="https://nandzz.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="report-reason">{c.reason}</Label>
        <select
          id="report-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as ReportReason)}
          className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
        >
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {c.reasons[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="report-details">{c.details}</Label>
        <Textarea
          id="report-details"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{c.detailsHint}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="report-name">{c.name}</Label>
          <Input id="report-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-email">{c.email}</Label>
          <Input
            id="report-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={320}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
        <input
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 shrink-0 accent-violet-600"
          checked={goodFaith}
          onChange={(e) => setGoodFaith(e.target.checked)}
        />
        <span>{c.goodFaith}</span>
      </label>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <Button type="submit" disabled={status === "sending" || !goodFaith}>
        {status === "sending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {status === "sending" ? c.sending : c.submit}
      </Button>
    </form>
  );
}
