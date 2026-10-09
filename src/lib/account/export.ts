// Shape of the GDPR data export (GET /api/account/export). Pure so it can be
// unit-tested; the route does the reads.

export type ExportSource = { key: string; table: string; column: string };

// Every table holding data that belongs to, or was authored by, the user.
export const EXPORT_SOURCES: ExportSource[] = [
  { key: "profile", table: "profiles", column: "id" },
  { key: "spaces", table: "spaces", column: "user_id" },
  { key: "collections", table: "collections", column: "user_id" },
  { key: "comments", table: "space_comments", column: "user_id" },
  { key: "likes", table: "space_likes", column: "user_id" },
  { key: "comment_likes", table: "comment_likes", column: "user_id" },
  { key: "following", table: "user_follows", column: "follower_id" },
  { key: "followers", table: "user_follows", column: "following_id" },
  { key: "notifications", table: "notifications", column: "user_id" },
  { key: "widgets", table: "widget_instances", column: "user_id" },
  { key: "bookings_received", table: "widget_bookings", column: "owner_user_id" },
  { key: "bookings_made", table: "widget_bookings", column: "created_by_user_id" },
  { key: "agent_documents", table: "agent_documents", column: "user_id" },
  { key: "credit_ledger", table: "credit_ledger", column: "user_id" },
  { key: "legal_acceptances", table: "legal_acceptances", column: "user_id" },
];

// Credentials / capability tokens are never exported — they grant access, they
// aren't information about the person.
const SECRET_KEYS = new Set(["manage_token", "access_token", "refresh_token", "token_hash", "secret"]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([k]) => !SECRET_KEYS.has(k))
        .map(([k, v]) => [k, redact(v)])
    );
  }
  return value;
}

export function buildAccountExport(input: {
  user: Record<string, unknown>;
  tables: Record<string, unknown>;
  now?: Date;
}) {
  const { profile, ...rest } = input.tables;
  return {
    format: "nandzz-account-export",
    version: 1,
    generated_at: (input.now ?? new Date()).toISOString(),
    notice:
      "Copy of your personal data held by Nandzz (GDPR Arts. 15 and 20). bookings_received contains your customers' data: you are its controller — handle it accordingly.",
    account: input.user,
    profile: Array.isArray(profile) ? redact(profile[0] ?? null) : redact(profile ?? null),
    data: redact(rest),
  };
}
