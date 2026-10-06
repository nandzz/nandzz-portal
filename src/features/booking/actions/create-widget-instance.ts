"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserEntitlements } from "@/lib/plan";
import { getFeatureFlags } from "@/lib/featureFlags";
import { defaultCalendarConfig } from "@/features/booking/domain/calendar";
import { suggestedCurrencyForLocale } from "@/features/booking/domain/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import { createWidgetInstanceSchema } from "../schemas";

export type CreateWidgetInstanceResult =
  | { ok: true; id: string }
  | {
      ok: false;
      error:
        | "UNAUTHENTICATED"
        | "INVALID_INPUT"
        | "PLAN_REQUIRED"
        | "NOT_AVAILABLE"
        | "FAILED";
      message?: string;
    };

// Adds a widget instance to the owner's profile. Widgets are unlocked by the
// the single paid plan (Pro) — no per-widget checkout. Created hidden (enabled: false);
// the owner flips it on from the widget's settings. One instance per
// (owner, widget type): an existing one is returned instead of a duplicate.
// Folded in from the old `POST /api/widgets/instances` route. The admin client
// is used for the catalog lookup + insert (the catalog is not RLS-readable and
// the insert seeds server-owned defaults); the SSR-client `auth.getUser()` +
// entitlement check above is the real authorization guard.
export async function createWidgetInstance(input: {
  catalogId: string;
}): Promise<CreateWidgetInstanceResult> {
  const parsed = createWidgetInstanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "INVALID_INPUT" };
  const { catalogId } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "UNAUTHENTICATED" };

  const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.hasWidgets) return { ok: false, error: "PLAN_REQUIRED" };

  const admin = createAdminClient();

  const { data: widget, error: widgetErr } = await admin
    .from("widget_catalog")
    .select("id, slug, active")
    .eq("id", catalogId)
    .single();
  if (widgetErr || !widget || !widget.active) {
    return { ok: false, error: "NOT_AVAILABLE" };
  }

  // The agent widget is an AI surface — unavailable while the AI flag is off.
  if (widget.slug === "agent" && !(await getFeatureFlags()).ai) {
    return { ok: false, error: "NOT_AVAILABLE" };
  }

  // One instance per (owner, widget type) — return the existing one if present.
  const { data: existing } = await admin
    .from("widget_instances")
    .select("id")
    .eq("user_id", user.id)
    .eq("catalog_id", catalogId)
    .maybeSingle();
  if (existing?.id) return { ok: true, id: existing.id as string };

  // Seed a new calendar widget's currency from the owner's locale (they can
  // change it in the services editor); other widget types don't price.
  const seedConfig =
    widget.slug === "calendar"
      ? { ...defaultCalendarConfig(), currency: suggestedCurrencyForLocale(await getCurrentLocale()) }
      : widget.slug === "agent"
        ? { enabled: true }
        : {};

  const { data: created, error: createErr } = await admin
    .from("widget_instances")
    .insert({ user_id: user.id, catalog_id: catalogId, config: seedConfig, enabled: false })
    .select("id")
    .single();
  if (createErr || !created) {
    return { ok: false, error: "FAILED", message: createErr?.message };
  }

  return { ok: true, id: created.id as string };
}
