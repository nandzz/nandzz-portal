import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Owner's widget instances (joined to their catalog type). Owner-scoped by RLS.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("widget_instances")
    .select("*, catalog:widget_catalog(*)")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
