import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import { profileUrl, textResult } from "./_demo.ts";

export const listDemoProfilesDef: ToolDefinition = {
  name: "list_demo_profiles",
  description:
    "List unclaimed demo profiles (newest first) with their content count and claim-code status. " +
    "Optionally filter by a search string on username / display name.",
  inputSchema: {
    type: "object",
    properties: {
      search: { type: "string", description: "Optional case-insensitive match on username or display name." },
      limit: { type: "integer", minimum: 1, maximum: 100, description: "Max rows (default 50)." },
    },
    additionalProperties: false,
  },
};

type Row = {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  spaces: { count: number }[];
  demo_claim_codes: {
    code_hint: string;
    expires_at: string;
    redeemed_at: string | null;
    revoked_at: string | null;
  }[];
};

export const listDemoProfiles: ToolHandler = async (args, ctx) => {
  const limit = typeof args.limit === "number" ? Math.min(Math.max(1, Math.floor(args.limit)), 100) : 50;
  let q = ctx.admin
    .from("profiles")
    .select("id, username, display_name, created_at, spaces(count), demo_claim_codes!demo_claim_codes_profile_id_fkey(code_hint, expires_at, redeemed_at, revoked_at)")
    .eq("is_demo", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (typeof args.search === "string" && args.search.trim()) {
    // Escape PostgREST filter metacharacters before embedding in .or().
    const s = args.search.trim().replace(/[%_,()\\]/g, (c) => `\\${c}`);
    q = q.or(`username.ilike.%${s}%,display_name.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new Error(`Failed to list demo profiles: ${error.message}`);

  const now = Date.now();
  const demos = ((data ?? []) as Row[]).map((r) => {
    const active = r.demo_claim_codes.find(
      (c) => !c.redeemed_at && !c.revoked_at && new Date(c.expires_at).getTime() > now,
    );
    return {
      demo_profile_id: r.id,
      username: r.username,
      display_name: r.display_name,
      profile_url: profileUrl(r.username),
      content_count: r.spaces[0]?.count ?? 0,
      created_at: r.created_at,
      claim_code: active ? { hint: `…${active.code_hint}`, expires_at: active.expires_at } : null,
    };
  });

  const lines = demos.map(
    (d) =>
      `- @${d.username} (${d.display_name ?? "—"}) · ${d.content_count} items · ` +
      (d.claim_code ? `code ${d.claim_code.hint} until ${d.claim_code.expires_at.slice(0, 10)}` : "no active code") +
      ` · id ${d.demo_profile_id}`,
  );
  return textResult(
    demos.length ? `${demos.length} demo profile(s):\n${lines.join("\n")}` : "No demo profiles found.",
    { demos },
  );
};
