"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check, Ban, RotateCcw, CalendarDays, X, Mail } from "lucide-react";
import type { BookingButtonStyle, SocialLinksStyle } from "@/lib/types";
import {
  bookingButtonPresentation,
  resolveBookingButtonStyle,
  type ResolvedBookingButtonStyle,
} from "@/lib/bookingButtonStyle";
import { InstagramIcon, LinkedinIcon } from "./BrandIcons";
import {
  INSTAGRAM_FILL,
  SocialLinkButtons,
  resolveSocialLinksStyle,
  type ResolvedSocialLinksStyle,
  type SocialLink,
} from "./SocialLinkButtons";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type Preset = { value: string; label: string };

// Soft tints for the page background — they sit behind everything, so they read
// best subtle. Plus a few deep tones.
const BG_PRESETS: Preset[] = [
  { value: "#ffffff", label: "White" },
  { value: "#faf5ff", label: "Violet" },
  { value: "#fdf2f8", label: "Pink" },
  { value: "#fff1f2", label: "Rose" },
  { value: "#fffbeb", label: "Amber" },
  { value: "#f0fdf4", label: "Green" },
  { value: "#ecfeff", label: "Cyan" },
  { value: "#eff6ff", label: "Blue" },
  { value: "#faf9f6", label: "Cream" },
  { value: "#f5f5f4", label: "Stone" },
  { value: "#1e1b2e", label: "Midnight" },
  { value: "#0f172a", label: "Navy" },
];

// Buttons/pills are foreground surfaces, so a bolder set works here.
const BTN_PRESETS: Preset[] = [
  { value: "#ffffff", label: "White" },
  { value: "#111827", label: "Black" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#2563eb", label: "Blue" },
  { value: "#0891b2", label: "Cyan" },
  { value: "#16a34a", label: "Green" },
  { value: "#e11d48", label: "Rose" },
  { value: "#ea580c", label: "Orange" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#334155", label: "Slate" },
  { value: "#f1f5f9", label: "Mist" },
  { value: "#fce7f3", label: "Blush" },
];

// Text colors — readable tones plus a few accents.
const TEXT_PRESETS: Preset[] = [
  { value: "#111827", label: "Black" },
  { value: "#ffffff", label: "White" },
  { value: "#334155", label: "Slate" },
  { value: "#6b7280", label: "Gray" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#2563eb", label: "Blue" },
  { value: "#0891b2", label: "Cyan" },
  { value: "#16a34a", label: "Green" },
  { value: "#e11d48", label: "Rose" },
  { value: "#d97706", label: "Amber" },
  { value: "#be185d", label: "Pink" },
  { value: "#f5f5f4", label: "Stone" },
];

// Booking CTA accents — saturated so the call-to-action stands out.
const BOOKING_PRESETS: Preset[] = [
  { value: "#10b981", label: "Emerald" },
  { value: "#16a34a", label: "Green" },
  { value: "#0891b2", label: "Cyan" },
  { value: "#2563eb", label: "Blue" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#db2777", label: "Pink" },
  { value: "#e11d48", label: "Rose" },
  { value: "#ea580c", label: "Orange" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#111827", label: "Black" },
  { value: "#ffffff", label: "White" },
  { value: "#a78bfa", label: "Lilac" },
];

const SWATCH =
  "relative flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";
const SELECTED = "border-violet-500 ring-2 ring-violet-500/40";

// One color group: label + hex field on one line, then a 7-col grid of
// default / presets / custom. 12 presets → exactly two rows.
function ColorGroup({
  label,
  value,
  presets,
  onChange,
  defaultLabel = "Default",
}: {
  label: string;
  value: string | null;
  presets: Preset[];
  onChange: (color: string | null) => void;
  defaultLabel?: string;
}) {
  const [hexDraft, setHexDraft] = useState(value ?? "");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHexDraft(value ?? ""); }, [value]);

  const commitHex = (raw: string) => {
    const v = raw.trim();
    if (HEX_RE.test(v)) onChange(v.toLowerCase());
    else setHexDraft(value ?? "");
  };

  const isPreset = presets.some((p) => p.value.toLowerCase() === value?.toLowerCase());
  const isCustom = value !== null && !isPreset;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitHex((e.target as HTMLInputElement).value);
          }}
          placeholder={defaultLabel}
          spellCheck={false}
          aria-label={`${label} hex`}
          className="w-[5.5rem] rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-right font-mono text-[11px] text-foreground placeholder:font-sans placeholder:text-muted-foreground focus:border-violet-500/50 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-7 justify-items-center gap-y-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={defaultLabel}
          title={defaultLabel}
          className={`${SWATCH} ${value === null ? SELECTED : "border-border/70"}`}
        >
          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {presets.map((c) => {
          const selected = value?.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              type="button"
              key={c.value}
              onClick={() => onChange(c.value)}
              aria-label={c.label}
              title={c.label}
              style={{ backgroundColor: c.value }}
              className={`${SWATCH} ${selected ? SELECTED : "border-border/40"}`}
            >
              {selected && <Check className="h-3.5 w-3.5 text-white mix-blend-difference" />}
            </button>
          );
        })}

        {/* Custom: rainbow ring around the picked color (or blank). */}
        <label
          title="Custom color"
          className={`${SWATCH} cursor-pointer p-[3px] ${isCustom ? "ring-2 ring-violet-500/40" : ""}`}
          style={{
            background:
              "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)",
          }}
        >
          <span
            className="flex h-full w-full items-center justify-center rounded-full bg-background"
            style={isCustom ? { backgroundColor: value as string } : undefined}
          >
            {isCustom && <Check className="h-3 w-3 text-white mix-blend-difference" />}
          </span>
          <input
            type="color"
            value={HEX_RE.test(value ?? "") && (value as string).length === 7 ? (value as string) : "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`Custom ${label.toLowerCase()} color`}
          />
        </label>
      </div>
    </section>
  );
}

// Segmented option row with a tiny visual per option.
function OptionRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; visual?: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <section>
      <p className="mb-2 text-xs font-medium text-foreground">{label}</p>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                active
                  ? "border-violet-500 bg-violet-500/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {o.visual}
              {o.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const VARIANT_VISUAL: Record<ResolvedBookingButtonStyle["variant"], React.ReactNode> = {
  soft: <span className="h-3 w-8 rounded-full border border-emerald-500/40 bg-emerald-500/15" />,
  solid: <span className="h-3 w-8 rounded-full bg-emerald-500" />,
  outline: <span className="h-3 w-8 rounded-full border-2 border-emerald-500" />,
  glass: <span className="h-3 w-8 rounded-full border border-white/30 bg-foreground/10 backdrop-blur" />,
};

const SHAPE_VISUAL: Record<ResolvedBookingButtonStyle["shape"], React.ReactNode> = {
  pill: <span className="h-3 w-8 rounded-full bg-foreground/30" />,
  rounded: <span className="h-3 w-8 rounded-[4px] bg-foreground/30" />,
  square: <span className="h-3 w-8 rounded-[1px] bg-foreground/30" />,
};

// Mini mock-ups of each social links layout. Neutral bars so they read on
// either theme; the active card picks up the violet accent.
const BAR = "bg-current opacity-35";
const LAYOUT_OPTIONS: {
  value: ResolvedSocialLinksStyle["layout"];
  label: string;
  hint: string;
  visual: React.ReactNode;
}[] = [
  {
    value: "icons",
    label: "Icons",
    hint: "Compact tiles",
    visual: (
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => <span key={i} className={`h-3.5 w-3.5 rounded-[4px] ${BAR}`} />)}
      </span>
    ),
  },
  {
    value: "chips",
    label: "Labeled",
    hint: "Icon + name",
    visual: (
      <span className="flex flex-wrap justify-center gap-1">
        {[0, 1].map((i) => (
          <span key={i} className="flex h-3.5 items-center gap-0.5 rounded-full border border-current/30 px-1">
            <span className={`h-1.5 w-1.5 rounded-full ${BAR}`} />
            <span className={`h-1 w-3 rounded-full ${BAR}`} />
          </span>
        ))}
      </span>
    ),
  },
  {
    value: "stack",
    label: "Stacked",
    hint: "Full-width buttons",
    visual: (
      <span className="flex w-14 flex-col gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex h-2.5 items-center justify-center rounded-[3px] border border-current/30">
            <span className={`h-0.5 w-5 rounded-full ${BAR}`} />
          </span>
        ))}
      </span>
    ),
  },
  {
    value: "minimal",
    label: "Minimal",
    hint: "Just the glyphs",
    visual: (
      <span className="flex gap-2">
        {[0, 1, 2].map((i) => <span key={i} className={`h-2.5 w-2.5 rounded-full ${BAR}`} />)}
      </span>
    ),
  },
];

const TONE_VISUAL: Record<ResolvedSocialLinksStyle["tone"], React.ReactNode> = {
  default: <span className="h-3.5 w-3.5 rounded-[4px] border border-current/30 bg-foreground/10" />,
  brand: (
    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border border-current/30">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-pink-500 to-blue-500" />
    </span>
  ),
  filled: <span className="h-3.5 w-3.5 rounded-[4px] bg-gradient-to-br from-amber-400 via-pink-500 to-blue-600" />,
};

// Shown in the preview when the owner hasn't added any links yet.
const SAMPLE_LINKS: SocialLink[] = [
  { key: "instagram", href: "#", label: "Instagram", icon: InstagramIcon, hoverClass: "", brandColor: "#e4405f", brandFill: INSTAGRAM_FILL },
  { key: "linkedin", href: "#", label: "LinkedIn", icon: LinkedinIcon, hoverClass: "", brandColor: "#0a66c2", brandFill: "#0a66c2" },
  { key: "email", href: "#", label: "Email", icon: Mail, hoverClass: "", brandColor: null, brandFill: "#475569" },
];

type Tab = "page" | "buttons" | "booking";

interface ProfileStylePickerProps {
  backgroundColor: string | null;
  onBackgroundChange: (color: string | null) => void;
  buttonColor: string | null;
  onButtonChange: (color: string | null) => void;
  textColor: string | null;
  onTextChange: (color: string | null) => void;
  social: {
    links: SocialLink[];
    style: SocialLinksStyle | null;
    onChange: (style: SocialLinksStyle | null) => void;
  };
  /** Only shown when the profile has a booking widget. */
  booking?: {
    label: string;
    style: BookingButtonStyle | null;
    onChange: (style: BookingButtonStyle | null) => void;
  };
  onReset: () => void;
}

export function ProfileStylePicker({
  backgroundColor,
  onBackgroundChange,
  buttonColor,
  onButtonChange,
  textColor,
  onTextChange,
  social,
  booking,
  onReset,
}: ProfileStylePickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("page");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape so the panel behaves like a popover.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isCustomized =
    backgroundColor !== null ||
    buttonColor !== null ||
    textColor !== null ||
    social.style !== null ||
    (booking?.style ?? null) !== null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "page", label: "Page" },
    { id: "buttons", label: "Buttons" },
    ...(booking ? [{ id: "booking" as const, label: "Booking" }] : []),
  ];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "page";

  const bookingStyle = resolveBookingButtonStyle(booking?.style);
  const patchBooking = (patch: Partial<ResolvedBookingButtonStyle>) =>
    booking?.onChange({ ...bookingStyle, ...patch });
  const bookingPreview = bookingButtonPresentation(booking?.style);

  const socialStyle = resolveSocialLinksStyle(social.style);
  const patchSocial = (patch: Partial<ResolvedSocialLinksStyle>) =>
    social.onChange({ ...socialStyle, ...patch });
  const hasLinks = social.links.length > 0;
  const previewLinks = hasLinks ? social.links : SAMPLE_LINKS;

  return (
    // Not `relative`: the panel anchors to the owner-controls column (the
    // nearest positioned ancestor), so it lines up with the right edge of the
    // whole button row instead of overflowing left on phones.
    <div ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Style"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-violet-500/50 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
      >
        <Palette className="h-3.5 w-3.5" />
        Style
      </button>

      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 flex max-h-[75vh] w-[19rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/95 shadow-xl backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
            <p className="text-sm font-semibold text-foreground">Style</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onReset}
                disabled={!isCustomized}
                title="Reset all to default"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-4 pb-3">
            <div role="tablist" className="flex rounded-lg bg-muted/60 p-0.5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={activeTab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === t.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-5 overflow-y-auto border-t border-border/50 px-4 py-4">
            {activeTab === "page" && (
              <>
                <ColorGroup
                  label="Background"
                  value={backgroundColor}
                  presets={BG_PRESETS}
                  onChange={onBackgroundChange}
                />
                <ColorGroup
                  label="Text"
                  value={textColor}
                  presets={TEXT_PRESETS}
                  onChange={onTextChange}
                />
              </>
            )}

            {activeTab === "buttons" && (
              <>
                {/* Live preview on the page's own background */}
                <div
                  className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border/50 bg-muted/30 px-3 py-4"
                  style={backgroundColor ? { backgroundColor } : undefined}
                >
                  <SocialLinkButtons
                    preview
                    links={previewLinks}
                    style={socialStyle}
                    buttonColor={buttonColor}
                  />
                  {!hasLinks && (
                    <p className="text-[10px] text-muted-foreground">
                      Sample links — add yours in Edit.
                    </p>
                  )}
                </div>

                <section>
                  <p className="mb-2 text-xs font-medium text-foreground">Layout</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LAYOUT_OPTIONS.map((o) => {
                      const active = socialStyle.layout === o.value;
                      return (
                        <button
                          type="button"
                          key={o.value}
                          onClick={() =>
                            patchSocial(
                              // Filled tiles need a surface; minimal falls back to brand glyphs.
                              o.value === "minimal" && socialStyle.tone === "filled"
                                ? { layout: o.value, tone: "brand" }
                                : { layout: o.value },
                            )
                          }
                          aria-pressed={active}
                          className={`flex flex-col items-center gap-2 rounded-xl border px-2 pt-3 pb-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                            active
                              ? "border-violet-500 bg-violet-500/10 text-foreground"
                              : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                          }`}
                        >
                          <span className="flex h-8 items-center justify-center">{o.visual}</span>
                          <span className="text-center leading-tight">
                            <span className="block text-[11px] font-medium">{o.label}</span>
                            <span className="block text-[10px] opacity-70">{o.hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {socialStyle.layout !== "minimal" && (
                  <OptionRow
                    label="Shape"
                    value={socialStyle.shape}
                    onChange={(shape) => patchSocial({ shape })}
                    options={[
                      { value: "pill", label: "Round", visual: SHAPE_VISUAL.pill },
                      { value: "rounded", label: "Soft", visual: SHAPE_VISUAL.rounded },
                      { value: "square", label: "Square", visual: SHAPE_VISUAL.square },
                    ]}
                  />
                )}
                <OptionRow
                  label="Size"
                  value={socialStyle.size}
                  onChange={(size) => patchSocial({ size })}
                  options={[
                    { value: "md", label: "Regular" },
                    { value: "lg", label: "Large" },
                  ]}
                />
                <OptionRow
                  label="Colors"
                  value={socialStyle.tone}
                  onChange={(tone) => patchSocial({ tone })}
                  options={[
                    { value: "default" as const, label: "Neutral", visual: TONE_VISUAL.default },
                    { value: "brand" as const, label: "Brand", visual: TONE_VISUAL.brand },
                    ...(socialStyle.layout !== "minimal"
                      ? [{ value: "filled" as const, label: "Filled", visual: TONE_VISUAL.filled }]
                      : []),
                  ]}
                />
                <div className="space-y-1.5">
                  <ColorGroup
                    label="Button color"
                    value={buttonColor}
                    presets={BTN_PRESETS}
                    onChange={onButtonChange}
                  />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    {socialStyle.tone === "filled"
                      ? "Filled links use brand colors — this tints the address pill."
                      : socialStyle.layout === "minimal"
                        ? "Tints the icons and the address pill."
                        : "Tints the link buttons and the address pill."}
                  </p>
                </div>
              </>
            )}

            {activeTab === "booking" && booking && (
              <>
                {/* Live preview on the page's own background */}
                <div
                  className="flex min-h-20 items-center justify-center rounded-xl border border-border/50 bg-muted/30 p-4"
                  style={backgroundColor ? { backgroundColor } : undefined}
                >
                  <span className={bookingPreview.className} style={bookingPreview.style}>
                    <CalendarDays className={bookingPreview.iconClass} />
                    {booking.label}
                  </span>
                </div>

                <OptionRow
                  label="Style"
                  value={bookingStyle.variant}
                  onChange={(variant) => patchBooking({ variant })}
                  options={[
                    { value: "soft", label: "Soft", visual: VARIANT_VISUAL.soft },
                    { value: "solid", label: "Solid", visual: VARIANT_VISUAL.solid },
                    { value: "outline", label: "Outline", visual: VARIANT_VISUAL.outline },
                    { value: "glass", label: "Glass", visual: VARIANT_VISUAL.glass },
                  ]}
                />
                <OptionRow
                  label="Shape"
                  value={bookingStyle.shape}
                  onChange={(shape) => patchBooking({ shape })}
                  options={[
                    { value: "pill", label: "Pill", visual: SHAPE_VISUAL.pill },
                    { value: "rounded", label: "Rounded", visual: SHAPE_VISUAL.rounded },
                    { value: "square", label: "Square", visual: SHAPE_VISUAL.square },
                  ]}
                />
                <OptionRow
                  label="Size"
                  value={bookingStyle.size}
                  onChange={(size) => patchBooking({ size })}
                  options={[
                    { value: "md", label: "Regular" },
                    { value: "lg", label: "Large" },
                  ]}
                />
                <ColorGroup
                  label="Color"
                  value={bookingStyle.color}
                  presets={BOOKING_PRESETS}
                  onChange={(color) => patchBooking({ color })}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
