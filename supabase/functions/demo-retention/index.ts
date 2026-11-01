// demo-retention — deletes unclaimed demo profiles 30 days after they were
// last pitched (latest claim code, else the demo's creation), with every file
// they own in Storage. Retention promised in the Privacy Policy (#demo-pages)
// and in the demo page's "why am I seeing this" sheet.
//
// Called daily by pg_cron (`demo_retention_dispatch`, migration
// 20261101150000). Picks candidates via `demo_retention_candidates` (service
// role only), removes Storage files first (deleting the auth user cascades the
// DB rows but not the files), then deletes the placeholder auth user.
//
// Auth: shared-secret header `x-booking-notify-secret` vs env
// BOOKING_NOTIFY_SECRET (project-wide secret, already set for
// booking-notifications; the cron reuses its vault entries).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOG = "[demo-retention]";
const BATCH = 25;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Every object under `<prefix>/` in a bucket, recursing into folders
// (Storage `list` is one level deep; folders come back with a null id).
async function listAll(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data?.length) break;
    for (const f of data) {
      const path = `${prefix}/${f.name}`;
      if (f.id === null) out.push(...(await listAll(admin, bucket, path)));
      else out.push(path);
    }
    if (data.length < 1000) break;
  }
  return out;
}

async function purgeFiles(admin: SupabaseClient, buckets: string[], demoId: string): Promise<number> {
  let removed = 0;
  for (const bucket of buckets) {
    const paths = await listAll(admin, bucket, demoId);
    // The pitch video sits at the bucket root: demo-videos/<id>.mp4.
    if (bucket === "demo-videos") paths.push(`${demoId}.mp4`);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
      if (error) throw new Error(`remove ${bucket}: ${error.message}`);
    }
    removed += paths.length;
  }
  return removed;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const expected = Deno.env.get("BOOKING_NOTIFY_SECRET");
  const provided = req.headers.get("x-booking-notify-secret");
  if (!expected || !provided || provided !== expected) {
    console.warn(`${LOG} unauthorized (bad or missing secret)`);
    return json({ error: "unauthorized" }, 401);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  const { data: candidates, error } = await admin.rpc("demo_retention_candidates", { p_limit: BATCH });
  if (error) {
    console.error(`${LOG} candidates failed:`, error.message);
    return json({ error: "candidates failed" }, 500);
  }
  if (!candidates?.length) return json({ ok: true, deleted: 0 });

  const { data: bucketRows, error: bucketErr } = await admin.storage.listBuckets();
  if (bucketErr) {
    console.error(`${LOG} listBuckets failed:`, bucketErr.message);
    return json({ error: "listBuckets failed" }, 500);
  }
  const buckets = (bucketRows ?? []).map((b) => b.id);

  const deleted: string[] = [];
  for (const { id, username } of candidates as { id: string; username: string }[]) {
    try {
      const files = await purgeFiles(admin, buckets, id);
      // Cascades the profile, spaces, widgets, bookings, codes and video row.
      const { error: delErr } = await admin.auth.admin.deleteUser(id);
      if (delErr) throw new Error(delErr.message);
      deleted.push(username);
      console.log(`${LOG} deleted @${username} (${files} files)`);
    } catch (err) {
      // Leave it for tomorrow's run; one failure doesn't stop the batch.
      console.error(`${LOG} @${username} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return json({ ok: true, deleted: deleted.length, usernames: deleted });
});
