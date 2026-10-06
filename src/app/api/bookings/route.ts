import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchBookerBookings, normalizeFilter } from "@/features/booking/data/booker-bookings";

// Load-more for the booker's own bookings. RLS on widget_bookings is owner-only,
// so we authenticate the user with the SSR client and read their rows through
// the service-role client, scoped to created_by_user_id.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const filter = normalizeFilter(searchParams.get("filter"));
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const now = Number.parseInt(searchParams.get("now") ?? "", 10) || Date.now();

  const admin = createAdminClient();
  const { bookings, hasMore } = await fetchBookerBookings(admin, user.id, filter, now, offset);

  return NextResponse.json({ bookings, hasMore });
}
