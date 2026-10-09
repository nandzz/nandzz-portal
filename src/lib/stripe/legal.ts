import "server-only";
import type Stripe from "stripe";
import { getCurrentLocale } from "@/lib/i18n/server";
import { toLegalLocale } from "@/features/legal/locale";

type CheckoutKind = "subscription" | "credits";

// Legal wording shown on Stripe Checkout, next to the pay button:
//  - subscriptions: auto-renewal + cancel-anytime + Terms link (Art. 49
//    Consumer Code pre-contract info, DSA/consumer best practice);
//  - credit packs: the consumer's express request for immediate supply and
//    acknowledgement of losing the withdrawal right (Art. 59(1)(o) Consumer
//    Code / Art. 16(m) CRD).
// The Terms link must be absolute — Checkout runs on stripe.com.
const TEXT: Record<"en" | "it", Record<CheckoutKind, string>> = {
  en: {
    subscription:
      "Your plan renews automatically at the end of each billing period until you cancel. You can cancel anytime from your dashboard; it stops at the end of the paid period. By subscribing you agree to the [Terms of Service]({site}/terms) and request that the service starts immediately. EU/UK consumers may still withdraw within 14 days and pay only for the days used.",
    credits:
      "By paying you agree to the [Terms of Service]({site}/terms) and expressly request that the credits are delivered immediately. You acknowledge that you lose your 14-day right of withdrawal once they are credited to your account.",
  },
  it: {
    subscription:
      "Il piano si rinnova automaticamente alla fine di ogni periodo finché non lo disdici. Puoi disdire in qualsiasi momento dalla dashboard: resta attivo fino alla fine del periodo pagato. Abbonandoti accetti i [Termini di Servizio]({site}/terms?lang=it) e chiedi che il servizio inizi subito. I consumatori UE/UK possono comunque recedere entro 14 giorni pagando solo i giorni goduti.",
    credits:
      "Pagando accetti i [Termini di Servizio]({site}/terms?lang=it) e chiedi espressamente che i crediti siano forniti subito. Riconosci di perdere il diritto di recesso di 14 giorni una volta accreditati sul tuo account.",
  },
};

export async function checkoutLegalParams(
  kind: CheckoutKind,
  siteUrl: string
): Promise<Pick<Stripe.Checkout.SessionCreateParams, "custom_text" | "consent_collection" | "locale">> {
  const locale = toLegalLocale(await getCurrentLocale());
  const message = TEXT[locale][kind].replaceAll("{site}", siteUrl.replace(/\/$/, ""));

  // Stripe's own required ToS checkbox. It refuses to create sessions until a
  // Terms URL is saved in Dashboard → Settings → Public details, so it is
  // opt-in per environment: set STRIPE_REQUIRE_TOS=1 once that's configured.
  if (process.env.STRIPE_REQUIRE_TOS === "1") {
    return {
      locale: locale === "it" ? "it" : "auto",
      consent_collection: { terms_of_service: "required" },
      custom_text: { terms_of_service_acceptance: { message } },
    };
  }
  return {
    locale: locale === "it" ? "it" : "auto",
    custom_text: { submit: { message } },
  };
}
