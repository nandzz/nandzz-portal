import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const { commentId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: comment } = await admin
    .from("space_comments")
    .select("user_id, space_id")
    .eq("id", commentId)
    .single();

  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: space } = await admin
    .from("spaces")
    .select("user_id")
    .eq("id", comment.space_id)
    .single();

  if (!space) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAuthor = comment.user_id === user.id;
  const isSpaceOwner = space.user_id === user.id;

  if (!isAuthor && !isSpaceOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await admin.from("space_comments").delete().eq("id", commentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
