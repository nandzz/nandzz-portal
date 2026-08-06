"use client";

import type { Location } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  locations: Location[];
  currentLocationId: string | null;
  onChange: (id: string) => void;
}

// Shown only once the owner has added at least one location (renders nothing
// otherwise, so callers can mount it unconditionally). Re-targets the
// Services / Staff / Availability sections below it to the selected
// location's own subtree instead of the legacy top-level config — see
// getLocationScope/withLocationScope in lib/widgets/calendar.ts.
export function LocationScopeBar({ locations, currentLocationId, onChange }: Props) {
  const { t } = useLanguage();
  if (locations.length === 0) return null;
  const value = currentLocationId && locations.some((l) => l.id === currentLocationId)
    ? currentLocationId
    : locations[0].id;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
      <label htmlFor="location-scope-select" className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
        {t.booking.locationContextLabel}
      </label>
      <select
        id="location-scope-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name || t.booking.unnamedLocation}
          </option>
        ))}
      </select>
    </div>
  );
}
