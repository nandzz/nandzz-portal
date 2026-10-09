import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAccountExport, EXPORT_SOURCES } from "@/lib/account/export";

// GDPR Arts. 15 & 20 — self-serve copy of the caller's personal data as JSON.
// Authenticates with the session, then reads with the admin client filtered
// strictly by the caller's id (some tables have no user-facing SELECT policy,
// e.g. credit_ledger).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const results = await Promise.all(
    EXPORT_SOURCES.map(async (src) => {
      const { data, error } = await admin.from(src.table).select("*").eq(src.column, user.id).limit(10000);
      return [src.key, error ? { error: "unavailable" } : data ?? []] as const;
    })
  );

  const collections = results.find(([k]) => k === "collections")?.[1];
  const collectionIds = Array.isArray(collections)
    ? (collections as { id: string }[]).map((c) => c.id)
    : [];
  const { data: collectionSpaces } = collectionIds.length
    ? await admin.from("collection_spaces").select("*").in("collection_id", collectionIds)
    : { data: [] };

  const body = buildAccountExport({
    user: {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      providers: (user.app_metadata?.providers as string[] | undefined) ?? [],
    },
    tables: Object.fromEntries([...results, ["collection_spaces", collectionSpaces ?? []]]),
  });

  const date = new Date().toISOString().split("T")[0];
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="nandzz-data-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
