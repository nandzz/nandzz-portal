import { redirect } from "next/navigation";

// /dashboard/billing predates the credits system. Funnel any deep-link to
// the new credits dashboard so links from old emails / bookmarks still resolve.
export default function BillingPage() {
  redirect("/dashboard/credits");
}
