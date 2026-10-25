"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, Circle, Info, Loader2, Phone, ShieldCheck, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ResponsivePanel, Section } from "./shared";

// Channels → WhatsApp. Placeholder flow: the Connect button simulates Meta's
// Embedded Signup (Coexistence) so the connected state can be designed. The
// real popup, token exchange and history sync come with the runtime.

const PERMISSIONS = [
  { id: "messages", label: "Read incoming messages and reply for you", required: true },
  { id: "history", label: "Import contacts and up to 180 days of chat history", required: false },
  { id: "learn", label: "Use that history to build the agent's knowledge", required: false },
  { id: "bookings", label: "Create, change and cancel bookings (within your autonomy settings)", required: true },
  { id: "voice", label: "Transcribe voice notes", required: false },
] as const;

type PermissionId = (typeof PERMISSIONS)[number]["id"];

const REQUIREMENTS = [
  "A WhatsApp Business app number (version 2.24.17 or later). Personal WhatsApp numbers can't connect.",
  "You keep using the app on your phone. Disappearing and view-once messages, live location and broadcast lists stop working, and linked devices are unlinked.",
  "Open the app on the phone at least every 14 days, or the number disconnects.",
];

type Status = "disconnected" | "connecting" | "connected";

export function WhatsAppChannel() {
  const [status, setStatus] = useState<Status>("disconnected");
  const [granted, setGranted] = useState<Record<PermissionId, boolean>>({
    messages: true,
    history: true,
    learn: true,
    bookings: true,
    voice: true,
  });
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const canConnect = PERMISSIONS.every((p) => !p.required || granted[p.id]);

  const connect = () => {
    setStatus("connecting");
    window.setTimeout(() => setStatus("connected"), 1200);
  };

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/my-agent"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> My Agent
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#25D366]/15">
          <Phone aria-hidden className="h-5 w-5 text-[#128C7E]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-amber-500" : "bg-muted-foreground/50",
              )}
            />
            {status === "connected" ? "Connected · +39 02 •••• 4821" : status === "connecting" ? "Connecting…" : "Not connected"}
          </p>
        </div>
      </div>

      {status !== "connected" ? (
        <>
          <Section
            title="Connect your WhatsApp Business number"
            description="Your number stays yours and the app keeps working on your phone. Every reply the agent sends shows up there too."
          >
            <ol className="mb-5 space-y-2 text-sm">
              {[
                "Choose what My Agent may access",
                "Log in with Facebook and pick your business",
                "Scan the QR code in the WhatsApp Business app",
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Access</legend>
              <PermissionList granted={granted} onChange={setGranted} />
            </fieldset>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button className="h-10 bg-[#25D366] text-[#073e2a] hover:bg-[#20bd5a]" disabled={!canConnect || status === "connecting"} onClick={connect}>
                {status === "connecting" ? <Loader2 aria-hidden className="animate-spin" /> : <Phone aria-hidden />}
                Connect with Meta
              </Button>
              <p className="text-xs text-muted-foreground">Preview: this simulates Meta&apos;s signup popup.</p>
            </div>
          </Section>

          <Section title="Before you connect">
            <ul className="space-y-2.5">
              {REQUIREMENTS.map((r) => (
                <li key={r} className="flex gap-2.5 text-sm text-muted-foreground">
                  <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
          </Section>
        </>
      ) : (
        <>
          <Section title="History import" description="Runs once, within 24 hours of connecting. Approve the sharing prompt in the WhatsApp app.">
            <ol className="space-y-3">
              {[
                { label: "Contacts", state: "done" },
                { label: "Last 24 hours", state: "done" },
                { label: "Last 90 days", state: "running" },
                { label: "90–180 days", state: "waiting" },
                { label: "Turn history into knowledge", state: "waiting" },
              ].map((s) => (
                <li key={s.label} className="flex items-center gap-2.5 text-sm">
                  {s.state === "done" ? (
                    <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600" />
                  ) : s.state === "running" ? (
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin text-violet-600" />
                  ) : (
                    <Circle aria-hidden className="h-4 w-4 text-muted-foreground/50" />
                  )}
                  <span className={cn(s.state === "waiting" && "text-muted-foreground")}>{s.label}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section
            title="Access you granted"
            description="Change any of these at any time."
            action={<ShieldCheck aria-hidden className="h-4 w-4 text-muted-foreground" />}
          >
            <PermissionList granted={granted} onChange={setGranted} />
          </Section>

          <Section title="Disconnect" description="Stops the agent, revokes our access and deletes imported history and transcripts.">
            <Button variant="destructive" className="h-10" onClick={() => setConfirmDisconnect(true)}>
              <Unplug aria-hidden /> Disconnect WhatsApp
            </Button>
          </Section>
        </>
      )}

      {confirmDisconnect && (
        <ResponsivePanel
          open
          onClose={() => setConfirmDisconnect(false)}
          title="Disconnect WhatsApp?"
          footer={
            <div className="flex gap-2">
              <Button variant="outline" className="h-10 flex-1" onClick={() => setConfirmDisconnect(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="h-10 flex-1"
                onClick={() => {
                  setStatus("disconnected");
                  setConfirmDisconnect(false);
                }}
              >
                Disconnect
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted-foreground">
            The agent stops replying right away. Your WhatsApp Business app keeps working, and your bookings stay in Nandzz.
          </p>
        </ResponsivePanel>
      )}
    </div>
  );
}

function PermissionList({
  granted,
  onChange,
}: {
  granted: Record<PermissionId, boolean>;
  onChange: (next: Record<PermissionId, boolean>) => void;
}) {
  return (
    <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
      {PERMISSIONS.map((p) => (
        <li key={p.id}>
          <label className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
            <span className="min-w-0">
              {p.label}
              {p.required && (
                <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Check aria-hidden className="h-3 w-3" /> required
                </span>
              )}
            </span>
            <Switch checked={granted[p.id]} onCheckedChange={(v) => onChange({ ...granted, [p.id]: v })} />
          </label>
        </li>
      ))}
    </ul>
  );
}
