import { legalMetadata, renderLegalPage } from "@/features/legal/render";

export const generateMetadata = legalMetadata("privacy");

export default function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderLegalPage("privacy", searchParams);
}
