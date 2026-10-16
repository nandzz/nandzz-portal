import { BarChart3, Bell, Check, Copy, FileText, Globe, Image as ImageIcon, AtSign, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideCopy, GuideStepId } from "../content";

// Static, non-interactive illustrations of each setup step. Built from plain
// markup (not the real dashboard components) so they never need data, auth or
// stores, follow the theme, and are localized through GuideCopy.visual.
// Every mock shows the same sample business so the steps read as one story.

const BRAND = { primary: "#0f766e", surface: "#e6f0ee", ink: "#0b3b37" };
const HANDLE = "studiolume";

type V = GuideCopy["visual"];

function Frame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none select-none rounded-2xl border bg-card p-4 shadow-sm sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

function Avatar({ size = 40 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ width: size, height: size, background: BRAND.primary }}
    >
      SL
    </div>
  );
}

function ClaimVisual({ v }: { v: V }) {
  return (
    <Frame>
      <div className="flex items-center rounded-xl border bg-background px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">nandzz.com/</span>
        <span className="font-medium">{HANDLE}</span>
        <span className="ml-0.5 h-4 w-px animate-pulse bg-foreground motion-reduce:animate-none" />
        <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          {v.available}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/50 p-3">
        <Avatar size={32} />
        <div className="min-w-0">
          <p className="text-sm font-medium">Studio Lume</p>
          <p className="text-xs text-muted-foreground">@{HANDLE}</p>
        </div>
      </div>
    </Frame>
  );
}

const SWATCHES = ["#ffffff", BRAND.surface, "#f3e8ff", "#fde68a", "#1f2937"];
const BUTTONS = [BRAND.primary, "#7c3aed", "#e11d48", "#111827"];

function StyleVisual({ v }: { v: V }) {
  return (
    <Frame className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <div className="rounded-xl p-4" style={{ background: BRAND.surface, color: BRAND.ink }}>
        <div className="flex items-center gap-3">
          <Avatar />
          <div>
            <p className="text-sm font-semibold">Studio Lume</p>
            <p className="flex items-center gap-1 text-xs opacity-70">
              <MapPin className="h-3 w-3" /> Via Roma 12
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 opacity-70">
          <AtSign className="h-4 w-4" />
          <Globe className="h-4 w-4" />
        </div>
        <div
          className="mt-4 rounded-lg py-2 text-center text-sm font-medium text-white"
          style={{ background: BRAND.primary }}
        >
          {v.bookNow}
        </div>
      </div>
      <div className="space-y-3 text-xs">
        <div>
          <p className="mb-1.5 text-muted-foreground">{v.background}</p>
          <div className="flex gap-1.5">
            {SWATCHES.map((c) => (
              <span
                key={c}
                className={cn("h-6 w-6 rounded-full border", c === BRAND.surface && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-muted-foreground">{v.buttons}</p>
          <div className="flex gap-1.5">
            {BUTTONS.map((c) => (
              <span
                key={c}
                className={cn("h-6 w-6 rounded-full", c === BRAND.primary && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

const TILES = ["#99c9c1", "#5aa69b", "#c9ded9", "#2f8a7f", "#b3d4ce", "#78b8ae"];

function ContentVisual({ v }: { v: V }) {
  return (
    <Frame>
      <div className="flex gap-1 rounded-lg bg-muted/60 p-1 text-xs">
        {v.tabs.map((tab, i) => (
          <span
            key={tab}
            className={cn("flex-1 rounded-md py-1 text-center", i === 2 ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {TILES.map((c, i) => (
          <div key={i} className="flex aspect-square items-end rounded-md p-1.5" style={{ background: c }}>
            {i === 0 && <ImageIcon className="h-3.5 w-3.5 text-white/90" />}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <span className="flex items-center gap-1 rounded-full border px-2.5 py-1">
          <AtSign className="h-3 w-3" /> Instagram
        </span>
        <span className="flex items-center gap-1 rounded-full border px-2.5 py-1">
          <FileText className="h-3 w-3" /> Brochure.pdf
        </span>
        <span className="flex items-center gap-1 rounded-full border px-2.5 py-1">
          <Globe className="h-3 w-3" /> Google Maps
        </span>
      </div>
    </Frame>
  );
}

const SLOTS = ["09:00", "10:30", "11:15", "14:00", "15:45", "17:30"];

function BookingVisual({ v }: { v: V }) {
  return (
    <Frame>
      <ul className="divide-y rounded-xl border text-sm">
        {v.services.map((s, i) => (
          <li key={s.name} className="flex items-center gap-3 px-3 py-2.5">
            <span
              className={cn("flex h-4 w-4 items-center justify-center rounded-full border", i === 0 && "border-transparent text-white")}
              style={i === 0 ? { background: BRAND.primary } : undefined}
            >
              {i === 0 && <Check className="h-3 w-3" />}
            </span>
            <span className="flex-1 font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground">{s.duration}</span>
            <span className="w-10 text-right tabular-nums">{s.price}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">{v.pickTime}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs tabular-nums">
        {SLOTS.map((t) => (
          <span
            key={t}
            className={cn("rounded-md border py-1.5 text-center", t === "10:30" && "border-transparent font-medium text-white")}
            style={t === "10:30" ? { background: BRAND.primary } : undefined}
          >
            {t}
          </span>
        ))}
      </div>
    </Frame>
  );
}

function ShareVisual({ v }: { v: V }) {
  return (
    <Frame>
      <div className="flex items-center gap-2 rounded-xl border bg-background py-1.5 pl-3 pr-1.5 text-sm">
        <span className="truncate">
          nandzz.com/<span className="font-medium">{HANDLE}</span>
        </span>
        <span className="ml-auto flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1 text-xs font-medium text-background">
          <Copy className="h-3 w-3" />
          {v.copyLink}
        </span>
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-xl border bg-background p-3 shadow-sm">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: BRAND.primary }}
        >
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0 text-sm">
          <p className="font-medium">{v.newBooking}</p>
          <p className="text-xs text-muted-foreground">Giulia R. · {v.newBookingDetail}</p>
        </div>
      </div>
    </Frame>
  );
}

const WEEK = [38, 52, 44, 61, 79, 92, 57];

function InsightsVisual({ v }: { v: V }) {
  const max = Math.max(...WEEK);
  const total = WEEK.reduce((a, b) => a + b, 0);
  return (
    <Frame>
      <div className="flex items-baseline justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" /> {v.visitors}
        </p>
        <p className="text-xs text-muted-foreground">{v.thisWeek}</p>
      </div>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{total}</p>
      <div className="mt-4 flex h-24 items-end gap-2">
        {WEEK.map((n, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t-md"
              style={{ height: `${(n / max) * 100}%`, background: i === 5 ? BRAND.primary : "color-mix(in oklch, " + BRAND.primary + " 30%, transparent)" }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2 text-center text-[10px] text-muted-foreground">
        {v.days.map((d, i) => (
          <span key={i} className="flex-1">
            {d}
          </span>
        ))}
      </div>
    </Frame>
  );
}

export const GUIDE_VISUALS: Record<GuideStepId, (props: { v: V }) => React.ReactElement> = {
  claim: ClaimVisual,
  style: StyleVisual,
  content: ContentVisual,
  booking: BookingVisual,
  share: ShareVisual,
  insights: InsightsVisual,
};
