import type { ReactNode } from "react";

export type LegalSection = {
  // Stable anchor id (same in every language so deep links survive a switch).
  id: string;
  title: string;
  body: ReactNode;
};

export type LegalDocument = {
  title: string;
  // Short line under the title (what the document covers).
  subtitle?: string;
  // Optional plain-language summary / preamble rendered before the sections.
  intro?: ReactNode;
  sections: LegalSection[];
};
