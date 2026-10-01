"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check, Ban, RotateCcw } from "lucide-react";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Soft tints for the page background — they sit behind everything, so they read
// best subtle. Plus one deep tone.
const BG_PRESETS: { value: string; label: string }[] = [
  { value: "#ffffff", label: "White" },
  { value: "#faf5ff", label: "Violet" },
  { value: "#fdf2f8", label: "Pink" },
  { value: "#fff1f2", label: "Rose" },
  { value: "#fffbeb", label: "Amber" },
  { value: "#f0fdf4", label: "Green" },
  { value: "#ecfeff", label: "Cyan" },
  { value: "#eff6ff", label: "Blue" },
  { value: "#f8fafc", label: "Slate" },
  { value: "#faf9f6", label: "Cream" },
  { value: "#f5f5f4", label: "Stone" },
  { value: "#1e1b2e", label: "Midnight" },
];

// Buttons/pills are foreground surfaces, so a bolder set works here.
const BTN_PRESETS: { value: string; label: string }[] = [
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
const TEXT_PRESETS: { value: string; label: string }[] = [
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

// One color group: a "default" chip, a swatch grid, and a custom color + hex.
function SwatchGroup({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: string | null;
  presets: { value: string; label: string }[];
  onChange: (color: string | null) => void;
}) {
  const [hexDraft, setHexDraft] = useState(value ?? "");
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setHexDraft(value ?? ""); }, [value]);

  const commitHex = (raw: string) => {
    const v = raw.trim();
    if (HEX_RE.test(v)) onChange(v.toLowerCase());
  };

  return (
    <div>
      <p className="mb-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>

      <div className="grid grid-cols-6 gap-2">
        <button
          onClick={() => onChange(null)}
          aria-label="Default"
          title="Default"
          className={`relative flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
            value === null ? "border-violet-500 ring-2 ring-violet-500/30" : "border-border/70"
          }`}
        >
          <Ban className="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        {presets.map((c) => {
          const selected = value?.toLowerCase() === c.value.toLowerCase();
          return (
            <button
              key={c.value}
              onClick={() => onChange(c.value)}
              aria-label={c.label}
              title={c.label}
              style={{ backgroundColor: c.value }}
              className={`relative flex h-7 w-7 items-center justify-center rounded-full border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                selected ? "border-violet-500 ring-2 ring-violet-500/30" : "border-border/40"
              }`}
            >
              {selected && <Check className="h-3.5 w-3.5 text-violet-600 mix-blend-difference" />}
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <label
          className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-border/60"
          style={{ backgroundColor: HEX_RE.test(value ?? "") ? (value as string) : undefined }}
          title="Custom color"
        >
          <input
            type="color"
            value={HEX_RE.test(value ?? "") ? (value as string) : "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`Custom ${label.toLowerCase()} color`}
          />
        </label>
        <input
          type="text"
          value={hexDraft}
          onChange={(e) => setHexDraft(e.target.value)}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitHex((e.target as HTMLInputElement).value);
          }}
          placeholder="#a1b2c3"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 py-1.5 font-mono text-xs text-foreground focus:border-violet-500/50 focus:outline-none"
        />
      </div>
    </div>
  );
}

interface ProfileStylePickerProps {
  backgroundColor: string | null;
  onBackgroundChange: (color: string | null) => void;
  buttonColor: string | null;
  onButtonChange: (color: string | null) => void;
  textColor: string | null;
  onTextChange: (color: string | null) => void;
  onReset: () => void;
}

export function ProfileStylePicker({
  backgroundColor,
  onBackgroundChange,
  buttonColor,
  onButtonChange,
  textColor,
  onTextChange,
  onReset,
}: ProfileStylePickerProps) {
  const [open, setOpen] = useState(false);
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
    backgroundColor !== null || buttonColor !== null || textColor !== null;

  return (
    <div ref={rootRef} className="relative">
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
        <div className="absolute top-full right-0 mt-2 max-h-[70vh] w-64 space-y-4 overflow-y-auto rounded-xl border border-border/60 bg-background/95 backdrop-blur-sm p-3 shadow-lg z-40">
          <SwatchGroup
            label="Background"
            value={backgroundColor}
            presets={BG_PRESETS}
            onChange={onBackgroundChange}
          />
          <SwatchGroup
            label="Buttons"
            value={buttonColor}
            presets={BTN_PRESETS}
            onChange={onButtonChange}
          />
          <SwatchGroup
            label="Text"
            value={textColor}
            presets={TEXT_PRESETS}
            onChange={onTextChange}
          />

          <button
            type="button"
            onClick={onReset}
            disabled={!isCustomized}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border/50 pt-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to default
          </button>
        </div>
      )}
    </div>
  );
}
