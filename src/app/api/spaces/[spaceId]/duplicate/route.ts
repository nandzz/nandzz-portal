import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKETS = {
  html_url: "space-html",
  pdf_url: "space-pdfs",
  image_url: "space-images",
  preview_image_url: "space-previews",
} as const;

type SpaceUrlField = keyof typeof BUCKETS;

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const clean = publicUrl.split("?")[0];
  const idx = clean.indexOf(marker);
  if (idx === -1) return null;
  return clean.slice(idx + marker.length);
}

function extForField(field: SpaceUrlField, sourcePath: string): string {
  const fromPath = sourcePath.split(".").pop();
  if (fromPath && fromPath.length <= 5) return fromPath;
  switch (field) {
    case "html_url": return "html";
    case "pdf_url": return "pdf";
    default: return "bin";
  }
}

function contentTypeForField(field: SpaceUrlField, ext: string): string {
  if (field === "html_url") return "text/html";
  if (field === "pdf_url") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function copyAsset(
  admin: ReturnType<typeof createAdminClient>,
  publicUrl: string,
  field: SpaceUrlField,
  newUserId: string
): Promise<string | null> {
  const bucket = BUCKETS[field];
  const sourcePath = extractStoragePath(publicUrl, bucket);
  if (!sourcePath) return publicUrl; // external URL — keep as-is

  const { data: blob, error: dlErr } = await admin.storage.from(bucket).download(sourcePath);
  if (dlErr || !blob) return null;

  const ext = extForField(field, sourcePath);
  const newPath = `${newUserId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const contentType = contentTypeForField(field, ext);

  const { error: upErr } = await admin.storage
    .from(bucket)
    .upload(newPath, blob, { contentType, upsert: false });
  if (upErr) return null;

  const { data: { publicUrl: newUrl } } = admin.storage.from(bucket).getPublicUrl(newPath);
  return newUrl;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const admin = createAdminClient();
  const { data: source } = await admin
    .from("spaces")
    .select("id, user_id, title, description, url, html_url, pdf_url, image_url, video_url, markdown_content, preview_image_url, preview_gradient, preview_title, is_public, hashtags")
    .eq("id", spaceId)
    .single();

  if (!source) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (!source.is_public && source.user_id !== user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const [html_url, pdf_url, image_url, preview_image_url] = await Promise.all([
    source.html_url ? copyAsset(admin, source.html_url, "html_url", user.id) : null,
    source.pdf_url ? copyAsset(admin, source.pdf_url, "pdf_url", user.id) : null,
    source.image_url ? copyAsset(admin, source.image_url, "image_url", user.id) : null,
    source.preview_image_url ? copyAsset(admin, source.preview_image_url, "preview_image_url", user.id) : null,
  ]);

  const failed =
    (source.html_url && !html_url) ||
    (source.pdf_url && !pdf_url) ||
    (source.image_url && !image_url);
  if (failed) {
    return NextResponse.json({ error: "COPY_FAILED" }, { status: 500 });
  }

  const payload = {
    title: `${source.title} (copy)`,
    description: source.description,
    url: source.url,
    html_url,
    pdf_url,
    image_url,
    video_url: source.video_url,
    markdown_content: source.markdown_content,
    preview_image_url,
    preview_gradient: source.preview_gradient,
    preview_title: source.preview_title,
    is_public: false,
    hashtags: source.hashtags ?? [],
  };

  const { data, error } = await admin.rpc("publish_space_tx", {
    p_user_id: user.id,
    p_space_payload: payload,
    p_client_request_id: randomUUID(),
  });

  if (error) {
    if (error.message?.includes("INSUFFICIENT_CREDITS")) {
      return NextResponse.json({ error: "INSUFFICIENT_CREDITS" }, { status: 402 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.space_id) {
    return NextResponse.json({ error: "NO_SPACE_ID" }, { status: 500 });
  }

  return NextResponse.json({ spaceId: row.space_id });
}
