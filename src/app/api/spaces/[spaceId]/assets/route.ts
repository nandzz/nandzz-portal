import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB per space
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // SVG excluded: can contain embedded <script> tags
]);

async function verifyOwner(spaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: space } = await admin
    .from("spaces")
    .select("user_id")
    .eq("id", spaceId)
    .single();

  return space?.user_id === user.id ? user : null;
}

async function listAssets(userId: string, spaceId: string) {
  const admin = createAdminClient();
  const prefix = `${userId}/${spaceId}`;
  const { data: files } = await admin.storage
    .from("space-assets")
    .list(prefix, { limit: 100 });

  return (files ?? []).map((f) => {
    const {
      data: { publicUrl },
    } = admin.storage
      .from("space-assets")
      .getPublicUrl(`${prefix}/${f.name}`);
    return { name: f.name, src: publicUrl, size: f.metadata?.size ?? 0 };
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const user = await verifyOwner(spaceId);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assets = await listAssets(user.id, spaceId);
  const usedBytes = assets.reduce((s, a) => s + a.size, 0);

  return NextResponse.json({ assets, usedBytes, limitBytes: MAX_BYTES });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const user = await verifyOwner(spaceId);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only images are allowed" }, { status: 415 });
  }

  const admin = createAdminClient();
  const prefix = `${user.id}/${spaceId}`;
  const { data: existing } = await admin.storage
    .from("space-assets")
    .list(prefix, { limit: 100 });
  const usedBytes = (existing ?? []).reduce(
    (s, f) => s + (f.metadata?.size ?? 0),
    0
  );

  if (usedBytes + file.size > MAX_BYTES) {
    const usedKB = (usedBytes / 1024).toFixed(0);
    return NextResponse.json(
      {
        error: `2 MB asset limit reached (${usedKB} KB used). Delete assets to free space.`,
      },
      { status: 413 }
    );
  }

  const rawExt = (file.name.split(".").pop() ?? "").toLowerCase();
  const ext = /^[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : "bin";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${prefix}/${filename}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from("space-assets")
    .upload(path, bytes, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("space-assets").getPublicUrl(path);

  return NextResponse.json({ src: publicUrl, name: file.name, size: file.size });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const user = await verifyOwner(spaceId);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  // Plain file names only — no "/" or ".." that could escape the space folder.
  if (!name || !/^[\w.-]+$/.test(name) || name.includes("..")) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const admin = createAdminClient();
  const path = `${user.id}/${spaceId}/${name}`;
  const { error } = await admin.storage.from("space-assets").remove([path]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
