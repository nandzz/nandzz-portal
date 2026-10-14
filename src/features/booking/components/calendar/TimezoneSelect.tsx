"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Searchable IANA timezone picker for the booking config. The visitor's own
// browser zone is pinned at the top so the common case is one click; the rest
// are filterable by city, region or offset ("rome", "europe", "gmt+2").

type Zone = { id: string; city: string; area: string; offset: string };

function browserZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

function allZoneIds(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return [];
  }
}

function describe(id: string): Zone {
  const parts = id.split("/");
  const city = (parts[parts.length - 1] ?? id).replace(/_/g, " ");
  const area = parts.length > 1 ? parts.slice(0, -1).join(" / ").replace(/_/g, " ") : "";
  let offset = "";
  try {
    offset =
      new Intl.DateTimeFormat("en-US", { timeZone: id, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    // Unknown to this runtime — show it without an offset.
  }
  return { id, city, area, offset };
}

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  // Location overrides may be blank (= inherit the business default); this
  // adds a "Business default" row that maps to "".
  allowEmpty?: boolean;
  className?: string;
}

export function TimezoneSelect({ id, value, onChange, allowEmpty = false, className = "" }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const detected = useMemo(() => (open ? browserZone() : null), [open]);

  // Describing ~400 zones builds a formatter each, so only do it once opened.
  const zones = useMemo(() => {
    if (!open) return [];
    const ids = allZoneIds();
    if (value && !ids.includes(value)) ids.push(value); // legacy alias, e.g. Europe/Kiev
    return ids.map(describe);
  }, [open, value]);

  type Row = { value: string; zone: Zone | null; label?: string };
  const rows = useMemo<Row[]>(() => {
    const q = query.trim().toLowerCase();
    const match = (z: Zone) =>
      !q ||
      z.id.toLowerCase().includes(q) ||
      z.city.toLowerCase().includes(q) ||
      z.offset.toLowerCase().includes(q);
    const out: Row[] = [];
    if (allowEmpty && !q) out.push({ value: "", zone: null, label: t.booking.timezoneUseDefault });
    const pinned = detected ? zones.find((z) => z.id === detected) : undefined;
    if (pinned && match(pinned)) out.push({ value: pinned.id, zone: pinned, label: t.booking.timezoneDetected });
    for (const z of zones) if (z.id !== pinned?.id && match(z)) out.push({ value: z.id, zone: z });
    return out;
  }, [zones, query, detected, allowEmpty, t]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the keyboard-highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const openPanel = () => {
    setQuery("");
    setActive(0);
    setOpen(true);
  };

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) pick(row.value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const current = value ? describe(value) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`flex w-full items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-sm ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {current ? (
            <>
              {current.city}
              <span className="ml-1.5 text-muted-foreground">
                {current.area}
                {current.offset && ` · ${current.offset}`}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">{t.booking.timezoneUseDefault}</span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={t.booking.timezoneSearchPlaceholder}
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>
          <ul ref={listRef} role="listbox" className="max-h-64 overflow-y-auto py-1">
            {rows.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted-foreground">{t.booking.timezoneNoResults}</li>
            )}
            {rows.map((row, i) => (
              <li
                key={row.value || "__default"}
                data-idx={i}
                role="option"
                aria-selected={row.value === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row.value)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${i === active ? "bg-muted" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {row.zone ? (
                    <>
                      {row.zone.city}
                      <span className="ml-1.5 text-muted-foreground">{row.zone.area}</span>
                    </>
                  ) : (
                    row.label
                  )}
                  {row.zone && row.label && (
                    <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      {row.label}
                    </span>
                  )}
                </span>
                {row.zone?.offset && <span className="shrink-0 text-xs text-muted-foreground">{row.zone.offset}</span>}
                {row.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
