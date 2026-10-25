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

const TOOLS: Record<string, Tool> = {
  ping: {
    definition: {
      name: "ping",
      description: "Health probe: returns the verified scope of the run token.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    run: async (db, token) => {
      const [row] = await db`select agent_api.ping(${token}) as result`;
      return row.result;
    },
  },
};

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
        console.error("[mcp-agent] tool failed:", name, message);
        return json(rpcError(body.id, -32603, "Internal error"), 500);
      }
    }
    default:
      return json(rpcError(body.id, -32601, `Method not found: ${body.method}`));
  }
});
