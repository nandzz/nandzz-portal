import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";

// Subscriptions that would otherwise keep billing a deleted account.
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Cancel every live Stripe subscription BEFORE deleting the user (Terms
  // §Termination: deletion cancels subscriptions immediately). If this fails
  // we abort, so an account is never deleted while still being charged. The
  // Stripe customer itself is kept: invoices are retained for tax law.
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.stripe_customer_id && isStripeConfigured()) {
    try {
      const stripe = getStripe();
      for await (const sub of stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 100,
      })) {
        if (LIVE_STATUSES.has(sub.status)) {
          await stripe.subscriptions.cancel(sub.id, { invoice_now: false, prorate: false });
        }
      }
    } catch (err) {
      console.error("[account/delete] Stripe cancellation failed", err);
      return NextResponse.json(
        { error: "Could not cancel your subscription. Please try again or contact support." },
        { status: 502 }
      );
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
