import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeCalendarConfig, validateCalendarConfig } from "@/lib/widgets/calendar";

// Update an owner's widget instance: its config and/or enabled flag. Config is
// validated per widget type (calendar today). Owner-scoped by RLS + the
// explicit user_id filter.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    enabled?: boolean;
    config?: unknown;
    sort_order?: number;
  };

  const { data: existing } = await supabase
    .from("widget_instances")
    .select("id, catalog:widget_catalog(slug)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slug = (existing.catalog as unknown as { slug?: string } | null)?.slug;
  const update: Record<string, unknown> = {};

  if (body.config !== undefined) {
    if (slug === "calendar") {
      const config = normalizeCalendarConfig(body.config);
      const errors = validateCalendarConfig(config);
      if (errors.length) {
        return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
      }
      update.config = config;
    } else {
      update.config = body.config;
    }
  }
  if (typeof body.enabled === "boolean") update.enabled = body.enabled;
  if (typeof body.sort_order === "number") update.sort_order = body.sort_order;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("widget_instances")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*, catalog:widget_catalog(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
