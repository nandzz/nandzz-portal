import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { verifyTwilioSignature } from "./twilio.ts";
import { classifyMime, mimeToExt, normalizeImage, FIELD_TO_BUCKET } from "./media.ts";
import { normalizePhone, extractUrl, todayDateString } from "./helpers.ts";
import { createSpace, addToUpdatesCollection } from "./spaces.ts";
import { twiml, REPLY } from "./replies.ts";

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authToken  = Deno.env.get("TWILIO_AUTH_TOKEN");
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  // TWILIO_WEBHOOK_URL must match the exact URL configured in the Twilio dashboard
  const webhookUrl = Deno.env.get("TWILIO_WEBHOOK_URL");

  if (!authToken || !accountSid || !webhookUrl) {
    console.log("[error] missing secrets:", { authToken: !!authToken, accountSid: !!accountSid, webhookUrl: !!webhookUrl });
    return new Response("OK", { status: 200 });
  }

  const rawBody = await req.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  console.log("[request] from:", params["From"], "numMedia:", params["NumMedia"], "body:", params["Body"]);

  const signatureHeader = req.headers.get("x-twilio-signature") ?? "";
  const valid = await verifyTwilioSignature(authToken, webhookUrl, params, signatureHeader);
  if (!valid) {
    console.log("[error] invalid Twilio signature — discarding");
    return new Response("OK", { status: 200 });
  }

  const numMedia    = parseInt(params["NumMedia"] ?? "0", 10);
  const messageBody = params["Body"] ?? "";
  const phone       = normalizePhone(params["From"] ?? "");

  console.log("[info] normalized phone:", phone);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userId, error: rpcError } = await admin.rpc(
    "get_user_id_by_verified_phone",
    { phone_number: phone },
  );
  console.log("[rpc] userId:", userId, "error:", rpcError?.message);

  if (rpcError || !userId) {
    console.log("[info] no verified user found for phone:", phone);
    return twiml(REPLY.notLinked);
  }

  // ── Text-only: must contain a URL ────────────────────────────────────────────
  if (numMedia === 0) {
    const url = extractUrl(messageBody);
    if (!url) return twiml(REPLY.noUrl);

    const title = todayDateString();
    const spaceId = await createSpace(admin, {
      user_id: userId,
      title,
      description: title,
      preview_title: title,
      url,
      is_public: true,
      likes_count: 0,
      views_count: 0,
      hashtags: [],
    });

    if (!spaceId) return twiml(REPLY.error);

    await addToUpdatesCollection(admin, userId, spaceId);
    return twiml(REPLY.linkSaved);
  }

  // ── Media attachments ─────────────────────────────────────────────────────────
  let savedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = params[`MediaUrl${i}`];
    const mimeType = params[`MediaContentType${i}`] ?? "";

    console.log(`[media ${i}] url: ${mediaUrl}, mime: ${mimeType}`);

    if (!mediaUrl) continue;

    const action = classifyMime(mimeType);
    if (!action) continue;

    const mediaRes = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}` },
    });
    console.log(`[media ${i}] download status: ${mediaRes.status}`);
    if (!mediaRes.ok) { errorCount++; continue; }

    const title = todayDateString();

    // ── Markdown / plain text ─────────────────────────────────────────────────
    if (action.kind === "text") {
      const content = await mediaRes.text();
      console.log(`[media ${i}] text content length: ${content.length}`);

      const spaceId = await createSpace(admin, {
        user_id: userId,
        title,
        description: title,
        preview_title: title,
        markdown_content: content,
        is_public: true,
        likes_count: 0,
        views_count: 0,
        hashtags: [],
      });

      if (!spaceId) { errorCount++; continue; }
      savedCount++;
      await addToUpdatesCollection(admin, userId, spaceId);
      continue;
    }

    // ── Binary storage (image / pdf / html) ───────────────────────────────────
    const rawBuffer = await mediaRes.arrayBuffer();
    console.log(`[media ${i}] downloaded: ${rawBuffer.byteLength} bytes`);

    let uploadBytes = new Uint8Array(rawBuffer);
    let uploadMime  = mimeType.split(";")[0].trim().toLowerCase();
    let uploadExt   = mimeToExt(mimeType);

    if (action.field === "image_url") {
      try {
        const normalized = await normalizeImage(rawBuffer, mimeType);
        uploadBytes = normalized.data;
        uploadMime  = normalized.contentType;
        uploadExt   = normalized.ext;
        console.log(`[media ${i}] normalized to JPEG: ${normalized.data.byteLength} bytes`);
      } catch (err) {
        console.log(`[media ${i}] normalization failed, uploading original:`, (err as Error).message);
      }
    }

    const bucket      = FIELD_TO_BUCKET[action.field];
    const storagePath = `${userId}/${Date.now()}.${uploadExt}`;

    const { error: uploadError } = await admin.storage
      .from(bucket)
      .upload(storagePath, uploadBytes, { contentType: uploadMime, upsert: false });

    console.log(`[media ${i}] upload to ${bucket} error: ${uploadError?.message ?? "none"}`);
    if (uploadError) { errorCount++; continue; }

    const { data: { publicUrl } } = admin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    const spaceId = await createSpace(admin, {
      user_id: userId,
      title,
      description: title,
      preview_title: title,
      [action.field]: publicUrl,
      is_public: true,
      likes_count: 0,
      views_count: 0,
      hashtags: [],
    });

    if (!spaceId) { errorCount++; continue; }
    savedCount++;
    await addToUpdatesCollection(admin, userId, spaceId);
  }

  if (savedCount === 0)  return twiml(REPLY.error);
  if (errorCount  > 0)   return twiml(REPLY.partialErr(savedCount, errorCount));
  return twiml(REPLY.mediaSaved(savedCount));
});
