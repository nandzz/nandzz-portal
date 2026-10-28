import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  type AdminClientLike,
  type Draft,
  EXTRACT_MODEL,
  handleCallBooking,
  MAX_AUDIO_BYTES,
  sanitizeDraft,
  todayIn,
  TRANSCRIBE_MODEL,
} from "../handler.ts";

// ---- Fixtures ---------------------------------------------------------------

const OWNER = "user-owner";
const INSTANCE = "inst-1";
// Wed 28 Oct 2026, 23:30 UTC — already Thursday 29th in Rome.
const NOW = new Date("2026-10-28T23:30:00Z");

const CONFIG = {
  timezone: "Europe/Rome",
  services: [{ id: "svc-legacy", name: "Legacy cut", duration_min: 30 }],
  staff: [{ id: "st-legacy", name: "Legacy Luca" }],
  locations: [
    {
      id: "loc-a",
      name: "Centro",
      timezone: "Europe/Rome",
      services: [
        { id: "svc-cut", name: "Taglio", duration_min: 30 },
        { id: "svc-color", name: "Colore", duration_min: 90 },
      ],
      staff: [{ id: "st-giulia", name: "Giulia" }],
    },
  ],
};

const DRAFT: Draft = {
  customer_name: "Mario Rossi",
  customer_phone: "+393331234567",
  customer_email: null,
  service_ids: ["svc-cut"],
  staff_id: "st-giulia",
  date: "2026-10-30",
  time: "10:30",
  time_window: null,
  notes: null,
  summary: "Mario vuole un taglio venerdì alle 10:30 con Giulia.",
};

// ---- Fakes ------------------------------------------------------------------

function makeAdmin(opts: {
  user?: { id: string } | null;
  instance?: { id: string; user_id: string; config: unknown } | null;
} = {}) {
  const getUserCalls: string[] = [];
  const lookups: Array<{ table: string; cols: string; eq: [string, unknown] }> = [];
  const admin: AdminClientLike = {
    auth: {
      getUser: (jwt) => {
        getUserCalls.push(jwt);
        return Promise.resolve({ data: { user: opts.user === undefined ? { id: OWNER } : opts.user } });
      },
    },
    from: (table) => ({
      select: (cols) => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            lookups.push({ table, cols, eq: [col, val] });
            return Promise.resolve({
              data: opts.instance === undefined ? { id: INSTANCE, user_id: OWNER, config: CONFIG } : opts.instance,
            });
          },
        }),
      }),
    }),
  };
  return { admin, getUserCalls, lookups };
}

type Call = { url: string; init: RequestInit };

function makeFetch(opts: {
  transcript?: string;
  transcribeStatus?: number;
  extractStatus?: number;
  extractContent?: string;
} = {}) {
  const calls: Call[] = [];
  const fakeFetch = ((input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/audio/transcriptions")) {
      const status = opts.transcribeStatus ?? 200;
      const body = status === 200 ? { text: opts.transcript ?? "Buongiorno, sono Mario Rossi..." } : { error: "x" };
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    }
    if (url.endsWith("/chat/completions")) {
      const status = opts.extractStatus ?? 200;
      const content = opts.extractContent ?? JSON.stringify(DRAFT);
      const body = status === 200 ? { choices: [{ message: { content } }] } : { error: "x" };
      return Promise.resolve(new Response(JSON.stringify(body), { status }));
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
  return { fetch: fakeFetch, calls };
}

function makeRequest(opts: {
  method?: string;
  jwt?: string | null;
  audio?: Blob | null;
  instanceId?: string | null;
  locationId?: string;
  locale?: string;
  rawBody?: string;
} = {}) {
  const headers = new Headers();
  if (opts.jwt !== null) headers.set("authorization", `Bearer ${opts.jwt ?? "jwt-owner"}`);
  if (opts.rawBody !== undefined) {
    headers.set("content-type", "text/plain");
    return new Request("http://localhost/call-booking", { method: "POST", headers, body: opts.rawBody });
  }
  const method = opts.method ?? "POST";
  if (method !== "POST") return new Request("http://localhost/call-booking", { method, headers });
  const form = new FormData();
  if (opts.audio !== null) form.append("audio", opts.audio ?? new Blob([new Uint8Array(2048)], { type: "audio/webm" }), "call.webm");
  if (opts.instanceId !== null) form.append("instance_id", opts.instanceId ?? INSTANCE);
  if (opts.locationId) form.append("location_id", opts.locationId);
  form.append("locale", opts.locale ?? "it");
  return new Request("http://localhost/call-booking", { method: "POST", headers, body: form });
}

async function run(
  req: Request,
  overrides: { admin?: ReturnType<typeof makeAdmin>; fetch?: ReturnType<typeof makeFetch>; apiKey?: string | undefined } = {},
) {
  const admin = overrides.admin ?? makeAdmin();
  const f = overrides.fetch ?? makeFetch();
  const logs: unknown[][] = [];
  const res = await handleCallBooking(req, {
    apiKey: "apiKey" in overrides ? overrides.apiKey : "sk-test",
    admin: admin.admin,
    fetch: f.fetch,
    now: () => NOW,
    log: (...args) => logs.push(args),
  });
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  return { res, body, admin, fetch: f, logs };
}

function systemPrompt(call: Call): string {
  return JSON.parse(String(call.init.body)).messages[0].content;
}

// ---- Method / config guards -------------------------------------------------

Deno.test("OPTIONS answers the CORS preflight without touching anything", async () => {
  const { res, admin, fetch } = await run(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assertEquals(admin.getUserCalls.length, 0);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("non-POST methods are rejected", async () => {
  const { res } = await run(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
});

Deno.test("missing OPENAI_API_KEY → 500 not_configured", async () => {
  const { res, body } = await run(makeRequest(), { apiKey: undefined });
  assertEquals(res.status, 500);
  assertEquals(body.error, "not_configured");
});

// ---- Auth + ownership -------------------------------------------------------

Deno.test("no bearer token → 401, no user lookup", async () => {
  const { res, admin } = await run(makeRequest({ jwt: null }));
  assertEquals(res.status, 401);
  assertEquals(admin.getUserCalls.length, 0);
});

Deno.test("token that resolves to no user → 401", async () => {
  const { res, fetch } = await run(makeRequest(), { admin: makeAdmin({ user: null }) });
  assertEquals(res.status, 401);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("the bearer token is what gets resolved", async () => {
  const { admin } = await run(makeRequest({ jwt: "abc.def.ghi" }));
  assertEquals(admin.getUserCalls, ["abc.def.ghi"]);
});

Deno.test("unknown instance → 403, OpenAI never called", async () => {
  const { res, fetch } = await run(makeRequest(), { admin: makeAdmin({ instance: null }) });
  assertEquals(res.status, 403);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("instance owned by someone else → 403, OpenAI never called", async () => {
  const { res, fetch } = await run(makeRequest(), {
    admin: makeAdmin({ instance: { id: INSTANCE, user_id: "someone-else", config: CONFIG } }),
  });
  assertEquals(res.status, 403);
  assertEquals(fetch.calls.length, 0);
});

Deno.test("instance is looked up by the posted instance_id", async () => {
  const { admin } = await run(makeRequest({ instanceId: "inst-xyz" }), {
    admin: makeAdmin({ instance: { id: "inst-xyz", user_id: OWNER, config: CONFIG } }),
  });
  assertEquals(admin.lookups[0].table, "widget_instances");
  assertEquals(admin.lookups[0].eq, ["id", "inst-xyz"]);
});

// ---- Input validation -------------------------------------------------------

Deno.test("non-multipart body → 400", async () => {
  const { res } = await run(makeRequest({ rawBody: "hello" }));
  assertEquals(res.status, 400);
});

Deno.test("missing audio → 400", async () => {
  const { res, body } = await run(makeRequest({ audio: null }));
  assertEquals(res.status, 400);
  assertEquals(body.error, "bad_request");
});

Deno.test("missing instance_id → 400", async () => {
  const { res } = await run(makeRequest({ instanceId: null }));
  assertEquals(res.status, 400);
});

Deno.test("empty audio → 400 empty_audio", async () => {
  const { res, body, fetch } = await run(makeRequest({ audio: new Blob([], { type: "audio/webm" }) }));
  assertEquals(res.status, 400);
  assertEquals(body.error, "empty_audio");
  assertEquals(fetch.calls.length, 0);
});

Deno.test("audio over the size limit → 413 audio_too_long", async () => {
  const big = new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)], { type: "audio/webm" });
  const { res, body, fetch } = await run(makeRequest({ audio: big }));
  assertEquals(res.status, 413);
  assertEquals(body.error, "audio_too_long");
  assertEquals(fetch.calls.length, 0);
});

// ---- Transcription ----------------------------------------------------------

Deno.test("transcription sends the audio, model and catalog names as a spelling prompt", async () => {
  const { fetch } = await run(makeRequest({ locationId: "loc-a" }));
  const call = fetch.calls[0];
  assertEquals(call.url, "https://api.openai.com/v1/audio/transcriptions");
  assertEquals(new Headers(call.init.headers).get("authorization"), "Bearer sk-test");
  const form = call.init.body as FormData;
  assertEquals(form.get("model"), TRANSCRIBE_MODEL);
  assert(form.get("file") instanceof File);
  assertEquals(form.get("prompt"), "Taglio, Colore, Giulia");
});

Deno.test("transcription failure → 502 and is logged", async () => {
  const { res, body, fetch, logs } = await run(makeRequest(), { fetch: makeFetch({ transcribeStatus: 500 }) });
  assertEquals(res.status, 502);
  assertEquals(body.error, "transcription_failed");
  assertEquals(fetch.calls.length, 1);
  assertEquals(logs.length, 1);
});

Deno.test("silent recording → draft null, extraction skipped", async () => {
  const { res, body, fetch } = await run(makeRequest(), { fetch: makeFetch({ transcript: "   " }) });
  assertEquals(res.status, 200);
  assertEquals(body, { transcript: "", draft: null });
  assertEquals(fetch.calls.length, 1);
});

// ---- Extraction -------------------------------------------------------------

Deno.test("happy path: returns transcript + draft", async () => {
  const { res, body } = await run(makeRequest({ locationId: "loc-a" }), {
    fetch: makeFetch({ transcript: "Buongiorno, sono Mario Rossi" }),
  });
  assertEquals(res.status, 200);
  assertEquals(body.transcript, "Buongiorno, sono Mario Rossi");
  assertEquals(body.draft, DRAFT);
});

Deno.test("extraction request: strict JSON schema, temperature 0, transcript as user message", async () => {
  const { fetch } = await run(makeRequest({ locationId: "loc-a" }), { fetch: makeFetch({ transcript: "ciao" }) });
  const call = fetch.calls[1];
  assertEquals(call.url, "https://api.openai.com/v1/chat/completions");
  const payload = JSON.parse(String(call.init.body));
  assertEquals(payload.model, EXTRACT_MODEL);
  assertEquals(payload.temperature, 0);
  assertEquals(payload.response_format.type, "json_schema");
  assertEquals(payload.response_format.json_schema.strict, true);
  assertEquals(payload.messages[1], { role: "user", content: "ciao" });
});

Deno.test("system prompt is grounded in the chosen location's catalog", async () => {
  const { fetch } = await run(makeRequest({ locationId: "loc-a" }));
  const prompt = systemPrompt(fetch.calls[1]);
  assertStringIncludes(prompt, '"id":"svc-cut"');
  assertStringIncludes(prompt, '"id":"st-giulia"');
  assert(!prompt.includes("svc-legacy"), "legacy top-level services must not leak into a location");
});

Deno.test("no location → falls back to the legacy top-level catalog", async () => {
  const { fetch } = await run(makeRequest());
  const prompt = systemPrompt(fetch.calls[1]);
  assertStringIncludes(prompt, '"id":"svc-legacy"');
  assertStringIncludes(prompt, '"id":"st-legacy"');
  assert(!prompt.includes("svc-cut"));
});

Deno.test("unknown location id → legacy catalog", async () => {
  const { fetch } = await run(makeRequest({ locationId: "loc-missing" }));
  assertStringIncludes(systemPrompt(fetch.calls[1]), '"id":"svc-legacy"');
});

Deno.test("system prompt resolves 'today' in the business timezone and names the locale", async () => {
  const { fetch } = await run(makeRequest({ locationId: "loc-a", locale: "de" }));
  const prompt = systemPrompt(fetch.calls[1]);
  // 23:30 UTC on the 28th is already Thursday the 29th in Rome.
  assertStringIncludes(prompt, "Today is Thursday 2026-10-29 (timezone Europe/Rome)");
  assertStringIncludes(prompt, 'language with code "de"');
});

Deno.test("location timezone wins over the instance timezone", async () => {
  const config = {
    ...CONFIG,
    timezone: "UTC",
    locations: [{ ...CONFIG.locations[0], timezone: "Asia/Tokyo" }],
  };
  const { fetch } = await run(makeRequest({ locationId: "loc-a" }), {
    admin: makeAdmin({ instance: { id: INSTANCE, user_id: OWNER, config } }),
  });
  assertStringIncludes(systemPrompt(fetch.calls[1]), "timezone Asia/Tokyo");
});

Deno.test("extraction failure → 502 but the transcript is still returned", async () => {
  const { res, body, logs } = await run(makeRequest(), {
    fetch: makeFetch({ transcript: "ciao", extractStatus: 429 }),
  });
  assertEquals(res.status, 502);
  assertEquals(body, { error: "extraction_failed", transcript: "ciao" });
  assertEquals(logs.length, 1);
});

Deno.test("malformed model output → 502 extraction_failed", async () => {
  const { res, body } = await run(makeRequest(), {
    fetch: makeFetch({ transcript: "ciao", extractContent: "{not json" }),
  });
  assertEquals(res.status, 502);
  assertEquals(body.error, "extraction_failed");
});

Deno.test("invented service and staff ids are stripped from the draft", async () => {
  const invented = { ...DRAFT, service_ids: ["svc-cut", "svc-made-up"], staff_id: "st-ghost" };
  const { body } = await run(makeRequest({ locationId: "loc-a" }), {
    fetch: makeFetch({ extractContent: JSON.stringify(invented) }),
  });
  assertEquals(body.draft.service_ids, ["svc-cut"]);
  assertEquals(body.draft.staff_id, null);
  assertEquals(body.draft.customer_name, "Mario Rossi");
});

Deno.test("ids from another location are stripped too", async () => {
  const crossLocation = { ...DRAFT, service_ids: ["svc-legacy"], staff_id: "st-legacy" };
  const { body } = await run(makeRequest({ locationId: "loc-a" }), {
    fetch: makeFetch({ extractContent: JSON.stringify(crossLocation) }),
  });
  assertEquals(body.draft.service_ids, []);
  assertEquals(body.draft.staff_id, null);
});

// ---- Pure helpers -----------------------------------------------------------

Deno.test("todayIn returns the civil date + weekday in the given zone", () => {
  assertEquals(todayIn("Europe/Rome", NOW), { date: "2026-10-29", weekday: "Thursday" });
  assertEquals(todayIn("America/New_York", NOW), { date: "2026-10-28", weekday: "Wednesday" });
});

Deno.test("sanitizeDraft keeps valid ids and tolerates a missing service_ids", () => {
  const services = [{ id: "a", name: "A", duration_min: 30 }];
  const staff = [{ id: "s", name: "S" }];
  assertEquals(sanitizeDraft({ ...DRAFT, service_ids: ["a"], staff_id: "s" }, services, staff).staff_id, "s");
  const loose = { ...DRAFT, service_ids: undefined } as unknown as Draft;
  assertEquals(sanitizeDraft(loose, services, staff).service_ids, []);
});
