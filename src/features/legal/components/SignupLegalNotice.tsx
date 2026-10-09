"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { MIN_AGE } from "../company";
import { fill, getLegalUi } from "../i18n";

const LINK = "underline underline-offset-2 hover:text-foreground";

// Click-wrap notice shown next to the button that creates the account /
// completes signup. Acceptance is recorded server-side when the profile is
// claimed (claimSignupProfile → acceptCurrentTerms).
export function SignupLegalNotice() {
  const { locale } = useLanguage();
  const ui = getLegalUi(locale);
  return (
    <p className="text-center text-xs leading-5 text-muted-foreground">
      {fill(ui.signupNotice, {
        terms: (
          <Link href="/terms" target="_blank" className={LINK}>
            {ui.termsLink}
          </Link>
        ),
        privacy: (
          <Link href="/privacy" target="_blank" className={LINK}>
            {ui.privacyLink}
          </Link>
        ),
        age: MIN_AGE,
      })}
    </p>
  );
}
