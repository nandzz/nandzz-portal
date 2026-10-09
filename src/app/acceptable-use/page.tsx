import { legalMetadata, renderLegalPage } from "@/features/legal/render";

export const generateMetadata = legalMetadata("acceptableUse");

export default function AcceptableUsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return renderLegalPage("acceptableUse", searchParams);
}
