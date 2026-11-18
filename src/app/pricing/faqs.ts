// Single source for the pricing FAQ — rendered visibly by PricingClient and
// emitted as FAQPage structured data by the pricing page so the two never drift.
export type PricingFaq = { q: string; a: string };

export const pricingFaqs: PricingFaq[] = [
  {
    q: "What's included?",
    a: "Free lets you build a page with up to 25 spaces and content sections, with the Nandzz badge. Starter (€5/month or €50/year) adds unlimited spaces, your own page style, analytics and removes the Nandzz badge. Pro (€27/month or €270/year) adds Booking and MCP access on top. Annual billing gives you 2 months free.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Yes. Move between Starter and Pro, switch between monthly and annual billing, or cancel anytime from your subscription page. Upgrades are charged pro rata right away; when you move down, the unused time is credited to your next invoice. Cancelling drops you back to the Free plan at the end of the billing period.",
  },
  {
    q: "Is my payment information secure?",
    a: "Payments are processed by Stripe, a PCI-compliant payment processor. We never store your card details.",
  },
];
