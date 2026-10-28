import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getOwnerWidgetById } from "@/features/booking/server";
import { FEATURES } from "@/lib/flags";

// PROTOTYPE (FEATURES.callAssist, dev only). Forwards a recorded phone call
// from the Today tab's "Check availability" modal to the `call-booking` edge
// function (transcription + booking-draft extraction; the OpenAI key lives
// there). Ownership is checked here and again in the function, which runs
// with the owner's own JWT.

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  if (!FEATURES.callAssist) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { instanceId } = await params;
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const widget = await getOwnerWidgetById(userId, instanceId);
  if (!widget || widget.catalog.slug !== "calendar") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  form.set("instance_id", instanceId);

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/call-booking`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({ error: "bad_gateway" }));
  return NextResponse.json(data, { status: res.status });
}
