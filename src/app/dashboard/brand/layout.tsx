import { redirect } from "next/navigation";
import { createClient, getUserIdFromClaims } from "@/lib/supabase/server";
import { getAccountType } from "@/lib/account/server";

// The Brand dashboard page itself is a client component, so its account-type
// gate lives here in a server layout: a business-only section that personal
// accounts can't reach by direct URL. Mirrors the redirect the Widgets /
// Analytics server pages apply inline.
export default async function BrandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const userId = await getUserIdFromClaims(supabase);
  if (!userId) redirect("/login");
  if ((await getAccountType(supabase, userId)) !== "business") redirect("/dashboard/bookings");

  return <>{children}</>;
}
