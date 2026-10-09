import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { cn } from "@/lib/utils";
import { LEGAL_DOCS, type LegalDocKey } from "../company";
import { formatLegalDate, type LegalLocale } from "../locale";
import type { LegalDocument } from "../types";

const NAV: { key: LegalDocKey; label: Record<LegalLocale, string> }[] = [
  { key: "terms", label: { en: "Terms", it: "Termini" } },
  { key: "privacy", label: { en: "Privacy", it: "Privacy" } },
  { key: "cookies", label: { en: "Cookies", it: "Cookie" } },
  { key: "acceptableUse", label: { en: "Acceptable Use", it: "Uso accettabile" } },
  { key: "dpa", label: { en: "DPA", it: "DPA" } },
  { key: "report", label: { en: "Report content", it: "Segnala contenuti" } },
  { key: "imprint", label: { en: "Legal notice", it: "Note legali" } },
];

const COPY = {
  en: {
    effective: "Effective",
    contents: "Contents",
    language: "Read in",
    other: "Italiano",
    prevails:
      "This document is also available in Italian. For consumers resident in Italy, the Italian version prevails.",
  },
  it: {
    effective: "In vigore dal",
    contents: "Indice",
    language: "Leggi in",
    other: "English",
    prevails:
      "Questo documento è disponibile anche in inglese. Per i consumatori residenti in Italia prevale la versione italiana.",
  },
} as const;

// Shared frame for every legal document: title, effective date, language
// switch, cross-links, table of contents and numbered sections.
export function LegalPage({
  doc,
  docKey,
  locale,
  children,
}: {
  doc: LegalDocument;
  docKey: LegalDocKey;
  locale: LegalLocale;
  // Extra content after the sections (e.g. the report form).
  children?: React.ReactNode;
}) {
  const meta = LEGAL_DOCS[docKey];
  const copy = COPY[locale];
  const otherLang = locale === "it" ? "en" : "it";

  return (
    <PageShell width="narrow" className="py-16">
      <nav aria-label="Legal" className="mb-8 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {NAV.map((item) => (
          <Link
            key={item.key}
            href={`${LEGAL_DOCS[item.key].path}?lang=${locale}`}
            aria-current={item.key === docKey ? "page" : undefined}
            className={cn(
              "text-muted-foreground transition-colors hover:text-foreground",
              item.key === docKey && "font-medium text-foreground"
            )}
          >
            {item.label[locale]}
          </Link>
        ))}
      </nav>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{doc.title}</h1>
      {doc.subtitle && <p className="mt-3 text-muted-foreground">{doc.subtitle}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>
          {copy.effective}: {formatLegalDate(meta.effectiveDate, locale)}
        </span>
        <span aria-hidden>·</span>
        <span>
          {copy.language}{" "}
          <Link
            href={`${meta.path}?lang=${otherLang}`}
            hrefLang={otherLang}
            className="text-violet-600 hover:underline dark:text-violet-400"
          >
            {copy.other}
          </Link>
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground/80">{copy.prevails}</p>

      <div className="mt-10 space-y-10 leading-7 text-muted-foreground">
        {doc.intro && <div>{doc.intro}</div>}

        {doc.sections.length > 3 && (
          <nav aria-label={copy.contents} className="rounded-xl border p-5">
            <p className="text-sm font-medium text-foreground">{copy.contents}</p>
            <ol className="mt-3 grid list-decimal gap-x-8 gap-y-1 pl-5 text-sm sm:grid-cols-2">
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="hover:text-foreground hover:underline">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {doc.sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-foreground">
              {i + 1}. {s.title}
            </h2>
            {s.body}
          </section>
        ))}

        {children}
      </div>
    </PageShell>
  );
}
