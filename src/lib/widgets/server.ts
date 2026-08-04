import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  WidgetCatalogEntry,
  WidgetInstance,
  WidgetInstanceWithCatalog,
} from "@/lib/types";

type SupabaseLike = ReturnType<typeof createAdminClient>;

// Which of these instance ids currently have a live subscription. One query
// instead of N `has_widget_access` RPC round-trips.
async function resolveEntitlements(
  db: SupabaseLike,
  instanceIds: string[]
): Promise<Set<string>> {
  if (instanceIds.length === 0) return new Set();
  const { data } = await db
    .from("widget_subscriptions")
    .select("instance_id, status, current_period_end")
    .in("instance_id", instanceIds);

  const now = Date.now();
  const entitled = new Set<string>();
  for (const row of data ?? []) {
    const live =
      (row.status === "active" || row.status === "trialing") &&
      (!row.current_period_end || new Date(row.current_period_end).getTime() > now);
    if (live) entitled.add(row.instance_id as string);
  }
  return entitled;
}

function join(
  instances: (WidgetInstance & { catalog: WidgetCatalogEntry })[],
  entitled: Set<string>
): WidgetInstanceWithCatalog[] {
  return instances.map((i) => ({ ...i, has_access: entitled.has(i.id) }));
}

// Enabled + entitled instances for a profile, used by the public profile page.
// Only widgets that are both enabled by the owner AND have a live subscription
// are returned — nothing else should render or accept input.
export async function getProfileWidgets(
  ownerId: string
): Promise<WidgetInstanceWithCatalog[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("widget_instances")
    .select("*, catalog:widget_catalog(*)")
    .eq("user_id", ownerId)
    .eq("enabled", true)
    .order("sort_order", { ascending: true });

  const instances = (data ?? []) as (WidgetInstance & { catalog: WidgetCatalogEntry })[];
  const entitled = await resolveEntitlements(admin, instances.map((i) => i.id));
  return join(instances, entitled).filter((i) => i.has_access);
}

// Every instance the owner has (enabled or not, entitled or not) for the
// dashboard. Uses the service-role client; callers must have already
// authenticated the owner.
export async function getOwnerWidgets(
  ownerId: string
): Promise<WidgetInstanceWithCatalog[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("widget_instances")
    .select("*, catalog:widget_catalog(*)")
    .eq("user_id", ownerId)
    .order("sort_order", { ascending: true });

  const instances = (data ?? []) as (WidgetInstance & { catalog: WidgetCatalogEntry })[];
  const entitled = await resolveEntitlements(admin, instances.map((i) => i.id));
  return join(instances, entitled);
}

export async function getOwnerWidgetById(
  ownerId: string,
  instanceId: string
): Promise<WidgetInstanceWithCatalog | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("widget_instances")
    .select("*, catalog:widget_catalog(*)")
    .eq("user_id", ownerId)
    .eq("id", instanceId)
    .maybeSingle();

  if (!data) return null;
  const instance = data as WidgetInstance & { catalog: WidgetCatalogEntry };
  const entitled = await resolveEntitlements(admin, [instance.id]);
  return { ...instance, has_access: entitled.has(instance.id) };
}

// Active widget types available to subscribe to.
export async function getWidgetCatalog(): Promise<WidgetCatalogEntry[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("widget_catalog")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as WidgetCatalogEntry[];
}
