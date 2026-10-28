// PROTOTYPE (portal FEATURES.callAssist, dev only). The Today tab's "Check
// availability" modal records a phone call in the owner's browser and posts
// the audio here when the call ends. We transcribe it with OpenAI, then ask a
// chat model to pull out a booking draft (customer, phone, service, staff,
// requested day/time) grounded in this location's real services and staff.
// Nothing is booked here: the owner reviews the draft in the modal and
// confirms through the normal /api/widgets/[id]/book route. No audio or
// transcript is stored.
//
// Request: multipart/form-data { audio: File, instance_id, location_id?, locale? }
// Response: { transcript: string, draft: Draft }
//
// The handler takes its dependencies (OpenAI key, admin client, fetch, clock)
// so _tests/ can drive it without network; index.ts wires the real ones.

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const TRANSCRIBE_MODEL = "gpt-4o-transcribe";
export const EXTRACT_MODEL = "gpt-4.1-mini";
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024; // OpenAI's transcription limit is 25MB

type Service = { id: string; name: string; duration_min: number };
type Staff = { id: string; name: string };

export type Draft = {
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  service_ids: string[];
  staff_id: string | null;
  date: string | null;
  time: string | null;
  time_window: "morning" | "afternoon" | "evening" | null;
  notes: string | null;
  summary: string;
};

// The slice of the Supabase admin client the handler uses.
export interface AdminClientLike {
  auth: { getUser(jwt: string): Promise<{ data: { user: { id: string } | null } }> };
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        maybeSingle(): Promise<{ data: { id: string; user_id: string; config: unknown } | null }>;
      };
    };
  };
}

export interface Deps {
  apiKey: string | undefined;
  admin: AdminClientLike;
  fetch: typeof fetch;
  now?: () => Date;
  log?: (...args: unknown[]) => void;
}

const DRAFT_SCHEMA = {
  name: "booking_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      customer_name: { type: ["string", "null"], description: "Caller's name as they said it." },
      customer_phone: { type: ["string", "null"], description: "Phone number, digits and leading + only." },
      customer_email: { type: ["string", "null"] },
      service_ids: {
        type: "array",
        items: { type: "string" },
        description: "Ids from the services list for what the caller wants. Empty if unclear.",
      },
      staff_id: { type: ["string", "null"], description: "Id from the staff list if the caller asked for someone." },
      date: { type: ["string", "null"], description: "Requested day as YYYY-MM-DD, resolved against today." },
      time: { type: ["string", "null"], description: "Requested start time as HH:MM (24h), if a precise one was agreed." },
      time_window: {
        type: ["string", "null"],
        enum: ["morning", "afternoon", "evening", null],
        description: "Rough part of day when no precise time was agreed.",
      },
      notes: { type: ["string", "null"], description: "Anything the business should remember (allergies, requests)." },
      summary: { type: "string", description: "One sentence summary of the call, in the owner's language." },
    },
    required: [
      "customer_name",
      "customer_phone",
      "customer_email",
      "service_ids",
      "staff_id",
      "date",
      "time",
      "time_window",
      "notes",
      "summary",
    ],
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export function todayIn(timeZone: string, now: Date = new Date()): { date: string; weekday: string } {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).format(now);
  return { date, weekday };
}

// Keep only catalog ids: the model must not invent services or staff.
export function sanitizeDraft(draft: Draft, services: Service[], staff: Staff[]): Draft {
  const serviceIds = new Set(services.map((s) => s.id));
  return {
    ...draft,
    service_ids: (draft.service_ids ?? []).filter((id) => serviceIds.has(id)),
    staff_id: draft.staff_id && staff.some((m) => m.id === draft.staff_id) ? draft.staff_id : null,
  };
}

export async function handleCallBooking(req: Request, deps: Deps): Promise<Response> {
  const { apiKey, admin, fetch, now = () => new Date(), log = console.error } = deps;
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  if (!apiKey) return json({ error: "not_configured" }, 500);

  // verify_jwt only proves the token is Supabase-signed; resolve the user and
  // check they own the widget below.
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const { data: { user: caller } } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  if (!caller) return json({ error: "Unauthorized" }, 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const audio = form.get("audio");
  const instanceId = String(form.get("instance_id") ?? "");
  const locationId = String(form.get("location_id") ?? "") || null;
  const locale = String(form.get("locale") ?? "en");
  if (!(audio instanceof File) || !instanceId) return json({ error: "bad_request" }, 400);
  if (audio.size === 0) return json({ error: "empty_audio" }, 400);
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: "audio_too_long" }, 413);

  const { data: instance } = await admin
    .from("widget_instances")
    .select("id, user_id, config")
    .eq("id", instanceId)
    .maybeSingle();
  if (!instance || instance.user_id !== caller.id) return json({ error: "Forbidden" }, 403);

  // Scope to the location the owner is viewing (legacy: top-level config).
  // deno-lint-ignore no-explicit-any
  const config: any = instance.config ?? {};
  const locations = Array.isArray(config.locations) ? config.locations : [];
  const loc = locationId ? locations.find((l: { id: string }) => l.id === locationId) : null;
  const scope = loc ?? config;
  const timezone: string = (loc?.timezone || config.timezone || "UTC") as string;
  const services: Service[] = (Array.isArray(scope.services) ? scope.services : []).map((s: Service) => ({
    id: s.id,
    name: s.name,
    duration_min: s.duration_min,
  }));
  const staff: Staff[] = (Array.isArray(scope.staff) ? scope.staff : []).map((m: Staff) => ({ id: m.id, name: m.name }));

  // 1) Transcribe. Service + staff names as a prompt help with spelling.
  const tf = new FormData();
  tf.append("file", audio, audio.name || "call.webm");
  tf.append("model", TRANSCRIBE_MODEL);
  tf.append("prompt", [...services.map((s) => s.name), ...staff.map((m) => m.name)].join(", ").slice(0, 800));
  const tRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: tf,
  });
  if (!tRes.ok) {
    log("[call-booking] transcription failed", tRes.status, await tRes.text());
    return json({ error: "transcription_failed" }, 502);
  }
  const transcript = String((await tRes.json()).text ?? "").trim();
  if (!transcript) return json({ transcript: "", draft: null });

  // 2) Extract a booking draft grounded in the real catalog.
  const today = todayIn(timezone, now());
  const system = [
    "You read the transcript of a phone call between a business and a client who wants to book an appointment.",
    "Extract a booking draft. Only use information actually said in the call; use null when something wasn't said.",
    "The transcript may not label speakers and may only contain one side of the call.",
    `Today is ${today.weekday} ${today.date} (timezone ${timezone}). Resolve relative days ("tomorrow", "next Thursday") against it.`,
    "Pick service_ids and staff_id ONLY from the lists below, matching by meaning (the call may use another language or a nickname).",
    `Write the summary in the language with code "${locale}".`,
    "",
    `Services: ${JSON.stringify(services)}`,
    `Staff: ${JSON.stringify(staff)}`,
  ].join("\n");

  const cRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      temperature: 0,
      response_format: { type: "json_schema", json_schema: DRAFT_SCHEMA },
      messages: [
        { role: "system", content: system },
        { role: "user", content: transcript },
      ],
    }),
  });
  if (!cRes.ok) {
    log("[call-booking] extraction failed", cRes.status, await cRes.text());
    return json({ error: "extraction_failed", transcript }, 502);
  }
  let draft: Draft | null;
  try {
    draft = JSON.parse((await cRes.json()).choices?.[0]?.message?.content ?? "null");
  } catch {
    return json({ error: "extraction_failed", transcript }, 502);
  }

  return json({ transcript, draft: draft ? sanitizeDraft(draft, services, staff) : null });
}
