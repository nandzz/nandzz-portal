// Single source of truth for the operator's legal identity and the version of
// each legal document. Every legal page, the footer and the imprint read from
// here — fill the [PLACEHOLDER] values once the company is registered.
//
// Bumping `LEGAL_DOCS.terms.version` asks every signed-in user to re-accept
// (see TermsUpdateBanner). Only bump it for MATERIAL changes, and publish the
// new text at least 30 days before `effectiveDate` (Terms §"Changes").

export const COMPANY = {
  brand: "Nandzz",
  legalName: "[LEGAL NAME] S.r.l.",
  registeredOffice: "[STREET, POSTCODE CITY (PROVINCE)], Italia",
  vatNumber: "[P.IVA — pending registration]",
  reaNumber: "[REA — pending registration]",
  shareCapital: "[SHARE CAPITAL]",
  pec: "[PEC ADDRESS]",
  website: "https://nandzz.com",
  emails: {
    support: "support@nandzz.com",
    privacy: "privacy@nandzz.com",
    legal: "legal@nandzz.com",
    // DSA single point of contact for authorities and users (Arts. 11–12).
    dsa: "dsa@nandzz.com",
  },
} as const;

// False while any identity field still holds a [PLACEHOLDER] — the footer then
// keeps the plain brand line instead of printing placeholders site-wide.
export const COMPANY_DETAILS_READY = ![COMPANY.legalName, COMPANY.vatNumber].some((v) => v.startsWith("["));

export type LegalDocKey =
  | "terms"
  | "privacy"
  | "cookies"
  | "dpa"
  | "acceptableUse"
  | "imprint"
  | "report";

export const LEGAL_DOCS: Record<LegalDocKey, { path: string; version: string; effectiveDate: string }> = {
  terms: { path: "/terms", version: "2026-10-06", effectiveDate: "2026-10-06" },
  privacy: { path: "/privacy", version: "2026-10-06", effectiveDate: "2026-10-06" },
  cookies: { path: "/cookies", version: "2026-10-06", effectiveDate: "2026-10-06" },
  dpa: { path: "/dpa", version: "2026-10-06", effectiveDate: "2026-10-06" },
  acceptableUse: { path: "/acceptable-use", version: "2026-10-06", effectiveDate: "2026-10-06" },
  imprint: { path: "/legal", version: "2026-10-06", effectiveDate: "2026-10-06" },
  report: { path: "/report", version: "2026-10-06", effectiveDate: "2026-10-06" },
};

// The version a user must have accepted to use the product without the banner.
export const CURRENT_TERMS_VERSION = LEGAL_DOCS.terms.version;

// Minimum ages (Terms §Eligibility). 14 = Italian age of digital consent
// (D.Lgs. 196/2003 art. 2-quinquies); business accounts must be adults.
export const MIN_AGE = 14;
export const MIN_BUSINESS_AGE = 18;

// The EU ODR platform was shut down on 20 July 2025 (Reg. (EU) 2024/3228), so
// no ODR link is published — the Terms point to national ADR bodies instead.
export const GARANTE_URL = "https://www.garanteprivacy.it";
