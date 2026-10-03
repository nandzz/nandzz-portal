import { getPublicPricing } from "@/lib/pricing";
import { getFeatureFlags } from "@/lib/featureFlags";

export const revalidate = 300;

function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (currency || "eur").toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

// Machine-readable pricing for AI agents comparing tools on a buyer's behalf.
// Mirrors the human /pricing page but stays trivially parseable (no JS, no auth).
export async function GET() {
  const [{ plans, packs }, { ai: aiEnabled }] = await Promise.all([
    getPublicPricing(),
    getFeatureFlags(),
  ]);

  const lines: string[] = ["# Pricing — Nandzz", ""];

  if (plans.length === 0) {
    lines.push("Pricing is temporarily unavailable. See https://nandzz.com/pricing.");
  } else {
    for (const plan of plans) {
      lines.push(`## ${plan.name}`);
      const price =
        plan.price_cents === 0
          ? "€0 / month (free)"
          : `${formatPrice(plan.price_cents, plan.currency)} / ${plan.billing_interval}`;
      lines.push(`- Price: ${price}`);
      if (plan.price_cents > 0 && plan.annual_price_cents) {
        lines.push(
          `- Annual price: ${formatPrice(plan.annual_price_cents, plan.currency)} / year (2 months free)`
        );
      }
      if (plan.price_cents > 0 && plan.trial_days > 0) {
        lines.push(`- Free trial: ${plan.trial_days} days`);
      }
      if (plan.description) lines.push(`- Summary: ${plan.description}`);
      lines.push(
        `- Spaces: ${plan.space_limit === null ? "Unlimited" : `Up to ${plan.space_limit}`}`
      );
      lines.push(`- Content, gallery & links sections: Yes`);
      lines.push(
        `- Booking${aiEnabled ? " & AI Agent" : ""}: ${plan.has_widgets ? "Yes" : "No"}`
      );
      if (aiEnabled) {
        lines.push(
          `- AI credits: ${
            plan.monthly_credits > 0
              ? `${plan.monthly_credits.toLocaleString("en-US")} per month`
              : "None"
          }`
        );
      }
      lines.push(`- MCP access (connect Claude): ${plan.has_mcp ? "Yes" : "No"}`);
      lines.push(`- Analytics: ${plan.has_analytics ? "Yes" : "No"}`);
      lines.push("");
    }

    if (aiEnabled && packs.length > 0) {
      lines.push("## Top-up AI credit packs");
      lines.push(
        "Available on the paid plan. Purchased credits never expire and are used only after the monthly plan allowance runs out."
      );
      lines.push("");
      for (const pack of packs) {
        lines.push(
          `- ${pack.name}: ${pack.credits.toLocaleString("en-US")} credits for ${formatPrice(
            pack.price_cents,
            pack.currency
          )}`
        );
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("Human pricing page: https://nandzz.com/pricing");
  lines.push("");

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
