import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Thin proxy → Supabase Edge Function (embed-document).
// Ownership is verified here; chunking + embedding + DB writes happen in the function.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/embed-document`;

  const upstream = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ document_id: id, user_id: user.id }),
  });

  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
