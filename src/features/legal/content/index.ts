import type { LegalDocKey } from "../company";
import type { LegalLocale } from "../locale";
import type { LegalDocument } from "../types";
import { acceptableUseEn, acceptableUseIt } from "./acceptable-use";
import { cookiesEn, cookiesIt } from "./cookies";
import { dpaEn } from "./dpa.en";
import { dpaIt } from "./dpa.it";
import { imprintEn, imprintIt } from "./imprint";
import { privacyEn } from "./privacy.en";
import { privacyIt } from "./privacy.it";
import { reportEn, reportIt } from "./report";
import { termsEn } from "./terms.en";
import { termsIt } from "./terms.it";

export const LEGAL_CONTENT: Record<LegalDocKey, Record<LegalLocale, LegalDocument>> = {
  terms: { en: termsEn, it: termsIt },
  privacy: { en: privacyEn, it: privacyIt },
  cookies: { en: cookiesEn, it: cookiesIt },
  dpa: { en: dpaEn, it: dpaIt },
  acceptableUse: { en: acceptableUseEn, it: acceptableUseIt },
  imprint: { en: imprintEn, it: imprintIt },
  report: { en: reportEn, it: reportIt },
};
