import type { ToolDefinition, ToolHandler } from "../../mcp/tools/types.ts";
import {
  buildProfilePatch,
  errorResult,
  applyProfileImages,
  profileFieldProps,
  profileFieldsMeta,
  profileUrl,
  textResult,
  validateUsername,
} from "./_demo.ts";

export const createDemoProfileDef: ToolDefinition = {
  name: "create_demo_profile",
  description:
    "Create a new public demo profile on Nandzz for a prospective client business (nandzz.com/<username>). " +
    "The profile is owned by a placeholder account until the business claims it with a code from create_claim_code. " +
    "Fill the WHOLE profile, not just the bio: profile picture (avatar_url — essential), address, social_links, " +
    "page colors matching the business's brand (background_color / button_color / text_color / booking_button_style), " +
    "optional cover_image_url. Opening hours go in configure_booking_widget, not the bio. " +
    "Returns demo_profile_id — pass it to the other tools to fill the profile with content.",
  inputSchema: {
    type: "object",
    required: ["username", "display_name"],
    properties: {
      username: {
        type: "string",
        description: "Profile handle, 3–30 chars, lowercase letters/digits/'_'/'-'. Becomes nandzz.com/<username>.",
      },
      ...profileFieldProps,
    },
    additionalProperties: false,
  },
  _meta: profileFieldsMeta,
};

export const createDemoProfile: ToolHandler = async (args, ctx) => {
  const username = validateUsername(args.username);
  const patch = buildProfilePatch(args);
  if (!patch.display_name) return errorResult("display_name is required.");

  const { data: taken, error: takenErr } = await ctx.admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (takenErr) throw new Error(`Username check failed: ${takenErr.message}`);
  if (taken) return errorResult(`Username "${username}" is already taken. Pick another.`);

  // Placeholder auth user. The .invalid TLD can never receive mail and the
  // random password is discarded, so nobody can sign in as it. handle_new_user
  // creates the profile row from user_metadata.username.
  const password = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const { data: created, error: createErr } = await ctx.admin.auth.admin.createUser({
    email: `demo+${crypto.randomUUID()}@demo.nandzz.invalid`,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: patch.display_name },
    app_metadata: { demo: true, created_by: ctx.userId },
  });
  if (createErr || !created?.user) {
    throw new Error(`Could not create placeholder account: ${createErr?.message ?? "unknown error"}`);
  }
  const demoId = created.user.id;

  try {
    await applyProfileImages(ctx, demoId, args, patch);
    const { error: updErr } = await ctx.admin
      .from("profiles")
      .update({ ...patch, is_demo: true })
      .eq("id", demoId);
    if (updErr) throw new Error(`Profile setup failed: ${updErr.message}`);
  } catch (err) {
    // Roll back the placeholder so a failed create leaves nothing behind.
    await ctx.admin.auth.admin.deleteUser(demoId).catch(() => {});
    throw err;
  }

  const url = profileUrl(username);
  return textResult(
    `Created demo profile @${username}.\nProfile URL: ${url}\nDemo profile ID: ${demoId}\n` +
      (patch.avatar_url ? "" : "⚠ No profile picture set — add one with update_demo_profile(avatar_url).\n") +
      "Next: add content with publish_link / publish_image / publish_html / publish_pdf (pass demo_profile_id), " +
      "then call create_claim_code when it's ready to share.",
    { demo_profile_id: demoId, username, profile_url: url },
  );
};
