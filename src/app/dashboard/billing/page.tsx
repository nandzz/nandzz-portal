import { redirect } from "next/navigation";

// /dashboard/billing is legacy. Funnel any deep-link to
// the subscription dashboard so links from old emails / bookmarks still resolve.
export default function BillingPage() {
  redirect("/dashboard/subscription");
}
