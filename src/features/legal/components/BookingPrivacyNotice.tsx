"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { fill, getLegalUi } from "../i18n";

// Notice under the booking submit button: booking accepts the Terms (guests
// never see the signup notice), plus the Art. 13/14 GDPR layered notice — the
// business is the controller, Nandzz its processor, with a link to the policy.
export function BookingPrivacyNotice({ businessName }: { businessName: string }) {
  const { locale } = useLanguage();
  const ui = getLegalUi(locale);
  return (
    <p className="text-center text-xs leading-5 text-muted-foreground">
      {fill(ui.bookingNotice, {
        terms: (
          <a
            href="/terms"
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {ui.termsLink}
          </a>
        ),
        business: <span className="font-medium text-foreground">{businessName}</span>,
        privacy: (
          <a
            href="/privacy#bookings"
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {ui.privacyLink}
          </a>
        ),
      })}
    </p>
  );
}
