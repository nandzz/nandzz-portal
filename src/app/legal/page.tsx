import { legalMetadata, renderLegalPage } from "@/features/legal/render";

export const generateMetadata = legalMetadata("imprint");

export default function LegalNoticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderLegalPage("imprint", searchParams);
}
