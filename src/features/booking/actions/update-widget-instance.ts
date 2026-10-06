"use server";

import type { WidgetInstanceWithCatalog } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarConfig, validateCalendarConfig } from "@/features/booking/domain/calendar";
import { updateWidgetInstanceSchema } from "../schemas";

export type UpdateWidgetInstanceResult =
  | { ok: true; instance: WidgetInstanceWithCatalog }
  | {
      ok: false;
      error:
        | "UNAUTHENTICATED"
        | "INVALID_INPUT"
        | "NOT_FOUND"
        | "INVALID_CONFIG"
        | "NOTHING_TO_UPDATE"
        | "FAILED";
      message?: string;
    };

// Update an owner's widget instance: its config and/or enabled flag and/or sort
// order. Config is validated per widget type (calendar today). Owner-scoped by
// RLS via the SSR server client + the explicit user_id filter — no admin client.
// Folded in from the old `PATCH /api/widgets/instances/[id]` route.
export async function updateWidgetInstance(input: {
  instanceId: string;
  config?: unknown;
  enabled?: boolean;
  sortOrder?: number;
}): Promise<UpdateWidgetInstanceResult> {
  const parsed = updateWidgetInstanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { instanceId, config, enabled, sortOrder } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const { data: existing } = await supabase
    .from("widget_instances")
    .select("id, catalog:widget_catalog(slug)")
    .eq("id", instanceId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!existing) return { ok: false, error: "NOT_FOUND" };

  const slug = (existing.catalog as unknown as { slug?: string } | null)?.slug;
  const update: Record<string, unknown> = {};

  if (config !== undefined) {
    if (slug === "calendar") {
      const normalized = normalizeCalendarConfig(config);
      const errors = validateCalendarConfig(normalized);
      if (errors.length) {
        return { ok: false, error: "INVALID_CONFIG", message: errors.join(" ") };
      }
      update.config = normalized;
    } else if (slug === "agent") {
      // Agent knowledge lives in agent_documents/agent_suggested_questions —
      // the instance config is just a minimal pass-through, no validation.
      const raw = config as { enabled?: boolean } | null | undefined;
      update.config = { ...(raw ?? {}), enabled: raw?.enabled ?? true };
    } else {
      update.config = config;
    }
  }
  if (typeof enabled === "boolean") update.enabled = enabled;
  if (typeof sortOrder === "number") update.sort_order = sortOrder;

  if (Object.keys(update).length === 0) {
    return { ok: false, error: "NOTHING_TO_UPDATE" };
  }

  const { data, error } = await supabase
    .from("widget_instances")
    .update(update)
    .eq("id", instanceId)
    .eq("user_id", user.id)
    .select("*, catalog:widget_catalog(*)")
    .single();

  if (error || !data) {
    return { ok: false, error: "FAILED", message: error?.message };
  }

  return { ok: true, instance: data as unknown as WidgetInstanceWithCatalog };
}
