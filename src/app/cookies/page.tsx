import { legalMetadata, renderLegalPage } from "@/features/legal/render";

export const generateMetadata = legalMetadata("cookies");

export default function CookiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderLegalPage("cookies", searchParams);
}
