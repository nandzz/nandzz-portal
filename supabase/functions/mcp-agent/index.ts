import postgres from "npm:postgres@3.4.5";

// Agent MCP: the tools the Business Agent uses for ONE WhatsApp customer.
// Its only client is the business-agent worker (Cloudflare), never OpenAI.
// Every tools/call carries the worker's per-call run token in the
// Authorization header; the database verifies it (agent_private.verify_run_token)
// and takes the business/customer scope from it. This function holds no
// service_role key: it connects as `agent_runtime`, which can only execute
// agent_api functions. See the roadmap section "Agent MCP security".

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "nandzz-agent-mcp", version: "0.1.0" };

const DB_URL = Deno.env.get("AGENT_DB_URL");
// Transaction pooler: no prepared statements.
const sql = DB_URL ? postgres(DB_URL, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 5 }) : null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
};

type Tool = {
  definition: { name: string; description: string; inputSchema: Record<string, unknown> };
  // token is passed straight to the DB; args are the model's (untrusted) arguments.
  run: (db: NonNullable<typeof sql>, token: string, args: Record<string, unknown>) => Promise<unknown>;
};

// Argument coercion: the DB re-checks everything; these only keep types sane.
const str = (v: unknown, max = 500) => (typeof v === "string" && v.length <= max ? v : null);
const strArr = (v: unknown) =>
  Array.isArray(v) && v.length <= 10 && v.every((x) => typeof x === "string" && x.length <= 100) ? (v as string[]) : null;
// Passed as a real jsonb value (a pre-stringified JSON would arrive as a jsonb string).
const jsonArg = (db: NonNullable<typeof sql>, v: unknown) => (v === undefined || v === null ? null : db.json(v as never));

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const TOOLS: Record<string, Tool> = {
  ping: {
    definition: {
      name: "ping",
      description: "Health probe: returns the verified scope of the run token.",
      inputSchema: schema({}),
    },
    run: async (db, token) => {
      const [row] = await db`select agent_api.ping(${token}) as result`;
      return row.result;
    },
  },
  get_context: {
    definition: {
      name: "get_context",
      description: "Business, agent settings, booking config and thread state for this chat.",
      inputSchema: schema({}),
    },
    run: async (db, token) => {
      const [row] = await db`select agent_api.get_context(${token}) as result`;
      return row.result;
    },
  },
  busy: {
    definition: {
      name: "busy",
      description: "Confirmed booking segments (times + staff) in a window.",
      inputSchema: schema(
        {
          from: { type: "string" },
          to: { type: "string" },
          location_id: { type: ["string", "null"] },
          exclude_booking_id: { type: ["string", "null"] },
        },
        ["from", "to"],
      ),
    },
    run: async (db, token, a) => {
      const [row] = await db`select agent_api.busy(${token}, ${str(a.from)}::timestamptz, ${str(a.to)}::timestamptz, ${str(a.location_id, 100)}, ${str(a.exclude_booking_id, 64)}::uuid) as result`;
      return row.result;
    },
  },
  search_knowledge: {
    definition: {
      name: "search_knowledge",
      description: "Search the business's knowledge.",
      inputSchema: schema({ query: { type: "string" } }, ["query"]),
    },
    run: async (db, token, a) => {
      const [row] = await db`select agent_api.search_knowledge(${token}, ${str(a.query) ?? ""}) as result`;
      return row.result;
    },
  },
  my_bookings: {
    definition: {
      name: "my_bookings",
      description: "Upcoming bookings made in this chat.",
      inputSchema: schema({}),
    },
    run: async (db, token) => {
      const [row] = await db`select agent_api.my_bookings(${token}) as result`;
      return row.result;
    },
  },
  create_booking: {
    definition: {
      name: "create_booking",
      description: "Book for this chat's customer (respects the owner's autonomy setting).",
      inputSchema: schema(
        {
          service_ids: { type: "array", items: { type: "string" } },
          starts_at: { type: "string" },
          location_id: { type: ["string", "null"] },
          staff_id: { type: ["string", "null"] },
          customer_name: { type: ["string", "null"] },
          segments: { type: "array" },
          locale: { type: ["string", "null"] },
        },
        ["service_ids", "starts_at", "segments"],
      ),
    },
    run: async (db, token, a) => {
      const [row] = await db`select agent_api.create_booking(
        ${token}, ${strArr(a.service_ids)}::text[], ${str(a.starts_at)}::timestamptz, ${str(a.location_id, 100)},
        ${str(a.staff_id, 100)}, ${str(a.customer_name, 200)}, ${jsonArg(db, a.segments)}::jsonb, ${str(a.locale, 10)}
      ) as result`;
      return row.result;
    },
  },
  reschedule_booking: {
    definition: {
      name: "reschedule_booking",
      description: "Move one of this chat's bookings (respects the owner's autonomy setting).",
      inputSchema: schema(
        { booking_id: { type: "string" }, starts_at: { type: "string" }, segments: { type: "array" } },
        ["booking_id", "starts_at", "segments"],
      ),
    },
    run: async (db, token, a) => {
      const [row] = await db`select agent_api.reschedule_booking(
        ${token}, ${str(a.booking_id, 64)}::uuid, ${str(a.starts_at)}::timestamptz, ${jsonArg(db, a.segments)}::jsonb
      ) as result`;
      return row.result;
    },
  },
  cancel_booking: {
    definition: {
      name: "cancel_booking",
      description: "Cancel one of this chat's bookings (respects the owner's autonomy setting).",
      inputSchema: schema({ booking_id: { type: "string" } }, ["booking_id"]),
    },
    run: async (db, token, a) => {
      const [row] = await db`select agent_api.cancel_booking(${token}, ${str(a.booking_id, 64)}::uuid) as result`;
      return row.result;
    },
  },
  get_approval: {
    definition: {
      name: "get_approval",
      description: "A decided approval request of this chat, for telling the customer.",
      inputSchema: schema({ approval_id: { type: "string" } }, ["approval_id"]),
    },
    run: async (db, token, a) => {
      const [row] = await db`select agent_api.get_approval(${token}, ${str(a.approval_id, 64)}::uuid) as result`;
      return row.result;
    },
  },
  hand_off: {
    definition: {
      name: "hand_off",
      description: "Pass the chat to the owner.",
      inputSchema: schema({ reason: { type: "string" } }, ["reason"]),
    },
    run: async (db, token, a) => {
      const [row] = await db`select agent_api.hand_off(${token}, ${str(a.reason, 1000) ?? ""}) as result`;
      return row.result;
    },
  },
  log_messages: {
    definition: {
      name: "log_messages",
      description: "Store the run's inbound and outbound messages.",
      inputSchema: schema(
        { messages: { type: "array" }, customer_name: { type: ["string", "null"] } },
        ["messages"],
      ),
    },
    run: async (db, token, a) => {
      const [row] = await db`select agent_api.log_messages(${token}, ${jsonArg(db, a.messages)}::jsonb, ${str(a.customer_name, 200)}) as result`;
      return row.result;
    },
  },
};

// Business errors the worker (and through it the model) may see: booking
// outcomes the customer can be told about. Everything else stays generic.
const BUSINESS_ERRORS = new Set([
  "SLOT_TAKEN", "OUT_OF_HOURS", "BLACKOUT", "STAFF_UNAVAILABLE", "INVALID_SERVICE", "INVALID_LOCATION",
  "WIDGET_UNAVAILABLE", "NO_ACCESS", "BOOKING_NOT_FOUND", "INVALID_RANGE", "APPROVAL_NOT_FOUND", "agent_not_connected",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const rpcResult = (id: JsonRpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const rpcError = (id: JsonRpcRequest["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

// Postgres errors raised by verify_run_token. Anything else stays generic so
// internals never reach the caller.
const TOKEN_ERRORS = new Set(["agent_token_invalid", "agent_token_expired", "agent_token_replayed"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, "Parse error"), 400);
  }

  // Notifications get no body (see memory: MCP notifications must return 202).
  if (body.id === undefined || body.id === null) return new Response(null, { status: 202 });

  switch (body.method) {
    case "initialize":
      return json(rpcResult(body.id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO }));
    case "tools/list":
      return json(rpcResult(body.id, { tools: Object.values(TOOLS).map((t) => t.definition) }));
    case "tools/call": {
      const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
      if (!token) return json(rpcError(body.id, -32001, "Unauthorized"), 401);
      const name = String(body.params?.name ?? "");
      const tool = TOOLS[name];
      if (!tool) return json(rpcError(body.id, -32602, `Unknown tool: ${name}`));
      if (!sql) {
        console.error("[mcp-agent] AGENT_DB_URL is not set");
        return json(rpcError(body.id, -32603, "Internal error"), 500);
      }
      const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await tool.run(sql, token, args);
        return json(rpcResult(body.id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result }));
      } catch (err) {
        const message = (err as { message?: string })?.message ?? "";
        if (TOKEN_ERRORS.has(message)) return json(rpcError(body.id, -32001, "Unauthorized"), 401);
        if (BUSINESS_ERRORS.has(message)) {
          const result = { error: message };
          return json(rpcResult(body.id, { content: [{ type: "text", text: JSON.stringify(result) }], structuredContent: result, isError: true }));
        }
        console.error("[mcp-agent] tool failed:", name, message);
        return json(rpcError(body.id, -32603, "Internal error"), 500);
      }
    }
    default:
      return json(rpcError(body.id, -32601, `Method not found: ${body.method}`));
  }
});
