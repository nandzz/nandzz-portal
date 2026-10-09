import { legalMetadata, renderLegalPage } from "@/features/legal/render";

export const generateMetadata = legalMetadata("terms");

export default function TermsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderLegalPage("terms", searchParams);
}
