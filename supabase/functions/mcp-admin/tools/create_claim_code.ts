import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import {
  claimUrl,
  demoOnlyIdProp,
  generateClaimCode,
  profileUrl,
  requireDemo,
  sha256Hex,
  textResult,
} from "./_demo.ts";

export const createClaimCodeDef: ToolDefinition = {
  name: "create_claim_code",
  description:
    "Generate a one-time activation code for a demo profile. The business enters it at nandzz.com/claim after signing up / logging in " +
    "to take ownership of the profile. Any previous unused code for this demo is revoked. " +
    "The code is shown ONLY in this response — it is stored hashed and cannot be retrieved later. " +
    "Claiming always makes the account a Business account; without Pro the claimed profile drops to Free and its " +
    "booking button disappears. BEFORE calling, ASK the admin whether to grant complimentary Pro on claim and for how " +
    "long (e.g. none, 1 or 2 months) — never pick a value yourself.",
  inputSchema: {
    type: "object",
    required: ["demo_profile_id", "grant_pro_months"],
    properties: {
      demo_profile_id: demoOnlyIdProp,
      grant_pro_months: {
        type: "integer",
        minimum: 0,
        maximum: 12,
        description:
          "Months of complimentary Pro applied when the business claims (0 = no grant). Must come from the admin's answer.",
      },
      expires_in_days: { type: "integer", minimum: 1, maximum: 365, description: "Validity in days (default 30)." },
    },
    additionalProperties: false,
  },
};

export const createClaimCode: ToolHandler = async (args, ctx) => {
  const demo = await requireDemo(ctx, args.demo_profile_id);
  const days = typeof args.expires_in_days === "number"
    ? Math.min(Math.max(1, Math.floor(args.expires_in_days)), 365)
    : 30;
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
  if (typeof args.grant_pro_months !== "number") {
    throw new Error("grant_pro_months is required — ask the admin whether to grant Pro on claim (0 = no).");
  }
  const proMonths = Math.min(Math.max(0, Math.floor(args.grant_pro_months)), 12);
  const proDays = proMonths * 30;

  // One active code per demo.
  const { error: revokeErr } = await ctx.admin
    .from("demo_claim_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("profile_id", demo.id)
    .is("redeemed_at", null)
    .is("revoked_at", null);
  if (revokeErr) throw new Error(`Could not revoke previous codes: ${revokeErr.message}`);

  const { code, normalized, hint } = generateClaimCode();
  const { error } = await ctx.admin.from("demo_claim_codes").insert({
    profile_id: demo.id,
    code_hash: await sha256Hex(normalized),
    code_hint: hint,
    expires_at: expiresAt,
    created_by: ctx.userId,
    grant_pro_days: proDays || null,
  });
  if (error) throw new Error(`Could not store claim code: ${error.message}`);

  const link = claimUrl(code);
  return textResult(
    `Claim code for @${demo.username}: ${code}\n` +
      `Claim link: ${link}\n` +
      `Profile: ${profileUrl(demo.username)}\n` +
      `Pro on claim: ${proMonths ? `${proMonths} month${proMonths === 1 ? "" : "s"}` : "none (Free)"}\n` +
      `Expires: ${expiresAt.slice(0, 10)}. Save it now — it can't be shown again.`,
    { demo_profile_id: demo.id, code, claim_url: link, expires_at: expiresAt, grant_pro_months: proMonths },
  );
};
