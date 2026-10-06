import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserEntitlements } from "@/lib/plan";
import { getFeatureFlags } from "@/lib/featureFlags";
import { defaultCalendarConfig } from "@/features/booking/domain/calendar";
import { suggestedCurrencyForLocale } from "@/features/booking/domain/messages";
import { getCurrentLocale } from "@/lib/i18n/server";
import type {
  WidgetCatalogEntry,
  WidgetInstance,
  WidgetInstanceWithCatalog,
} from "@/lib/types";

// Widget access is now a plan entitlement, not a per-instance subscription.
// Every instance an owner has shares the same access boolean = their plan's
// hasWidgets. One plan lookup instead of N subscription rows.
function join(
  instances: (WidgetInstance & { catalog: WidgetCatalogEntry })[],
  hasWidgets: boolean
): WidgetInstanceWithCatalog[] {
  return instances.map((i) => ({ ...i, has_access: hasWidgets }));
}

// Enabled instances for a profile, used by the public profile page. Only widgets
// the owner enabled AND whose owner's plan includes widgets are returned —
// nothing else should render or accept input.
export async function getProfileWidgets(
  ownerId: string
): Promise<WidgetInstanceWithCatalog[]> {
  const admin = createAdminClient();
  const [{ data }, entitlements] = await Promise.all([
    admin
      .from("widget_instances")
      .select("*, catalog:widget_catalog(*)")
      .eq("user_id", ownerId)
      .eq("enabled", true)
      .order("sort_order", { ascending: true }),
    getUserEntitlements(ownerId),
  ]);

  if (!entitlements.hasWidgets) return [];
  const instances = (data ?? []) as (WidgetInstance & { catalog: WidgetCatalogEntry })[];
  return join(instances, true);
}

// A single enabled instance for a profile, used by the public, shareable
// per-widget page. Returns null unless it's live (owner-enabled AND the owner's
// plan includes widgets) — the same gate as getProfileWidgets, for one id.
export async function getPublicWidgetById(
  ownerId: string,
  instanceId: string
): Promise<WidgetInstanceWithCatalog | null> {
  const admin = createAdminClient();
  const [{ data }, entitlements] = await Promise.all([
    admin
      .from("widget_instances")
      .select("*, catalog:widget_catalog(*)")
      .eq("user_id", ownerId)
      .eq("id", instanceId)
      .eq("enabled", true)
      .maybeSingle(),
    getUserEntitlements(ownerId),
  ]);

  if (!data || !entitlements.hasWidgets) return null;
  const instance = data as WidgetInstance & { catalog: WidgetCatalogEntry };
  return { ...instance, has_access: true };
}

// Every instance the owner has (enabled or not) for the dashboard. Uses the
// service-role client; callers must have already authenticated the owner.
export async function getOwnerWidgets(
  ownerId: string
): Promise<WidgetInstanceWithCatalog[]> {
  const admin = createAdminClient();
  const [{ data }, entitlements] = await Promise.all([
    admin
      .from("widget_instances")
      .select("*, catalog:widget_catalog(*)")
      .eq("user_id", ownerId)
      .order("sort_order", { ascending: true }),
    getUserEntitlements(ownerId),
  ]);

  const instances = (data ?? []) as (WidgetInstance & { catalog: WidgetCatalogEntry })[];
  return join(instances, entitlements.hasWidgets);
}

export async function getOwnerWidgetById(
  ownerId: string,
  instanceId: string
): Promise<WidgetInstanceWithCatalog | null> {
  const admin = createAdminClient();
  const [{ data }, entitlements] = await Promise.all([
    admin
      .from("widget_instances")
      .select("*, catalog:widget_catalog(*)")
      .eq("user_id", ownerId)
      .eq("id", instanceId)
      .maybeSingle(),
    getUserEntitlements(ownerId),
  ]);

  if (!data) return null;
  const instance = data as WidgetInstance & { catalog: WidgetCatalogEntry };
  return { ...instance, has_access: entitlements.hasWidgets };
}

// Booking is now a first-class feature surface, not an add-on picked from a
// catalog: every business has exactly one calendar instance. Fetch the owner's
// calendar, provisioning it on first visit (hidden until they enable it) so the
// `/dashboard/booking` page always has an instance to render. Access is gated
// separately via `has_access` = the owner's plan's hasWidgets, so this
// provisions for every business account regardless of plan — a non-paying
// account simply sees the workspace in its locked/inactive state.
export async function getOrCreateOwnerCalendar(
  ownerId: string
): Promise<WidgetInstanceWithCatalog | null> {
  const admin = createAdminClient();

  const { data: catalogRow } = await admin
    .from("widget_catalog")
    .select("*")
    .eq("slug", "calendar")
    .eq("active", true)
    .maybeSingle();
  if (!catalogRow) return null;
  const catalog = catalogRow as WidgetCatalogEntry;

  const [{ data: existing }, entitlements] = await Promise.all([
    admin
      .from("widget_instances")
      .select("*, catalog:widget_catalog(*)")
      .eq("user_id", ownerId)
      .eq("catalog_id", catalog.id)
      .maybeSingle(),
    getUserEntitlements(ownerId),
  ]);

  if (existing) {
    const instance = existing as WidgetInstance & { catalog: WidgetCatalogEntry };
    return { ...instance, has_access: entitlements.hasWidgets };
  }

  // Seed a fresh calendar with the owner's locale-appropriate currency (they can
  // change it in the services editor). Hidden until the owner flips it on from
  // booking settings.
  const seedConfig = {
    ...defaultCalendarConfig(),
    currency: suggestedCurrencyForLocale(await getCurrentLocale()),
  };
  const { data: created, error } = await admin
    .from("widget_instances")
    .insert({ user_id: ownerId, catalog_id: catalog.id, config: seedConfig, enabled: false })
    .select("*")
    .single();

  // Lost an insert race (one instance per owner+type): re-fetch the row the
  // other request created rather than surfacing a duplicate-key error.
  if (error || !created) {
    const { data: raced } = await admin
      .from("widget_instances")
      .select("*, catalog:widget_catalog(*)")
      .eq("user_id", ownerId)
      .eq("catalog_id", catalog.id)
      .maybeSingle();
    if (!raced) return null;
    const instance = raced as WidgetInstance & { catalog: WidgetCatalogEntry };
    return { ...instance, has_access: entitlements.hasWidgets };
  }

  const instance = created as WidgetInstance;
  return { ...instance, catalog, has_access: entitlements.hasWidgets };
}

// Owner's plan-level widget access, for surfaces that don't need instances.
export async function ownerHasWidgetAccess(ownerId: string): Promise<boolean> {
  const entitlements = await getUserEntitlements(ownerId);
  return entitlements.hasWidgets;
}

// Active widget types available to add. The `agent` widget is an AI surface, so
// it's filtered out of the catalog while the AI feature flag is off.
export async function getWidgetCatalog(): Promise<WidgetCatalogEntry[]> {
  const admin = createAdminClient();
  const [{ data }, { ai }] = await Promise.all([
    admin
      .from("widget_catalog")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    getFeatureFlags(),
  ]);
  const catalog = (data ?? []) as WidgetCatalogEntry[];
  return ai ? catalog : catalog.filter((c) => c.slug !== "agent");
}
