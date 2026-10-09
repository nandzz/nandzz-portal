import "server-only";
import type { Metadata } from "next";
import { LEGAL_DOCS, type LegalDocKey } from "./company";
import { LegalPage } from "./components/LegalPage";
import { LEGAL_CONTENT } from "./content";
import { resolveLegalLocale } from "./server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Route-level helpers so each app/<legal>/page.tsx is a two-liner.
export function legalMetadata(docKey: LegalDocKey) {
  return async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
    const locale = await resolveLegalLocale(searchParams);
    const doc = LEGAL_CONTENT[docKey][locale];
    const path = LEGAL_DOCS[docKey].path;
    return {
      title: doc.title,
      description: doc.subtitle,
      alternates: {
        canonical: path,
        languages: { en: `${path}?lang=en`, it: `${path}?lang=it` },
      },
    };
  };
}

export async function renderLegalPage(
  docKey: LegalDocKey,
  searchParams: SearchParams,
  children?: React.ReactNode
) {
  const locale = await resolveLegalLocale(searchParams);
  return (
    <LegalPage doc={LEGAL_CONTENT[docKey][locale]} docKey={docKey} locale={locale}>
      {children}
    </LegalPage>
  );
}
