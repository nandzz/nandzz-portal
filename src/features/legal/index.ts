// Client-safe public API for the legal feature. Server-only pieces (document
// rendering, locale resolution, acceptance reads) live in `render.tsx` and
// `server.ts`.
export { COMPANY, LEGAL_DOCS, CURRENT_TERMS_VERSION, MIN_AGE, MIN_BUSINESS_AGE } from "./company";
export type { LegalDocKey } from "./company";
export { toLegalLocale, type LegalLocale } from "./locale";
export { LegalPageSkeleton } from "./components/LegalPageSkeleton";
export { ReportContentForm } from "./components/ReportContentForm";
export { SignupLegalNotice } from "./components/SignupLegalNotice";
export { BookingPrivacyNotice } from "./components/BookingPrivacyNotice";
export { TermsUpdateBanner } from "./components/TermsUpdateBanner";
export { ReportLink } from "./components/ReportLink";
export { DataExport } from "./components/DataExport";
export { acceptCurrentTerms } from "./actions/accept-terms";
