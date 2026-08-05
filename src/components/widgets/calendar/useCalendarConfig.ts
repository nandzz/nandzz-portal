"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { CalendarConfig } from "@/lib/types";
import { normalizeCalendarConfig, validateCalendarConfig } from "@/lib/widgets/calendar";

export interface CalendarConfigController {
  config: CalendarConfig;
  setConfig: Dispatch<SetStateAction<CalendarConfig>>;
  enabled: boolean;
  setEnabled: Dispatch<SetStateAction<boolean>>;
  saving: boolean;
  status: { ok: boolean; msg: string } | null;
  save: () => Promise<void>;
}

// Single source of truth for a calendar widget instance's config + enabled flag.
// Instantiated ONCE per instance (in WidgetWorkspace) and shared by every editor
// surface (Settings studio, Staff manager) so their saves never PATCH from a
// stale snapshot and clobber one another — Settings edits `services[].staff_ids`,
// Staff edits `config.staff`, both mutate the same object here.
export function useCalendarConfig(
  instanceId: string,
  initialConfig: CalendarConfig,
  initialEnabled: boolean
): CalendarConfigController {
  const [config, setConfig] = useState<CalendarConfig>(() => normalizeCalendarConfig(initialConfig));
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const save = useCallback(async () => {
    const errors = validateCalendarConfig(config);
    if (errors.length > 0) {
      setStatus({ ok: false, msg: errors[0] });
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/widgets/instances/${instanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, enabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ ok: false, msg: data.error ?? "Could not save." });
        return;
      }
      setStatus({ ok: true, msg: "Saved." });
    } catch {
      setStatus({ ok: false, msg: "Could not save." });
    } finally {
      setSaving(false);
    }
  }, [config, enabled, instanceId]);

  return { config, setConfig, enabled, setEnabled, saving, status, save };
}
