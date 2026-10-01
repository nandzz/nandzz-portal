// Single source for the pricing FAQ — rendered visibly by PricingClient and
// emitted as FAQPage structured data by the pricing page so the two never drift.
//
// Entries tagged `ai: true` are only shown while the AI feature flag is on
// (the pricing page filters them out otherwise); see `pricingFaqsFor`.
export type PricingFaq = { q: string; a: string; ai?: boolean };

export const pricingFaqs: PricingFaq[] = [
  {
    q: "What do the plans include?",
    a: "The Free plan lets you build a branded page with up to 25 spaces and content sections. The paid plan unlocks the booking widget, analytics, MCP access and unlimited spaces.",
  },
  {
    q: "How do AI credits work?",
    ai: true,
    a: "Paid plans include a monthly AI credit allowance that resets each billing period. Credits are spent on AI features — chatting with your agent and editing pages with AI. Need more? Buy top-up packs that never expire; they're only used after your monthly allowance runs out.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Yes — upgrade, downgrade or cancel anytime from your subscription page. Cancelling drops you back to the Free plan at the end of the billing period.",
  },
  {
    q: "Do purchased credits expire?",
    ai: true,
    a: "No. Top-up credits you buy never expire. Only the monthly plan allowance resets each period.",
  },
  {
    q: "Is my payment information secure?",
    a: "Payments are processed by Stripe, a PCI-compliant payment processor. We never store your card details.",
  },
];

// The FAQ list for a given AI state — drops AI-only entries when AI is off.
export function pricingFaqsFor(aiEnabled: boolean): PricingFaq[] {
  return aiEnabled ? pricingFaqs : pricingFaqs.filter((f) => !f.ai);
}
