import { legalMetadata, renderLegalPage } from "@/features/legal/render";
import { ReportContentForm } from "@/features/legal";
import { resolveLegalLocale } from "@/features/legal/server";

export const generateMetadata = legalMetadata("report");

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ url }, locale] = await Promise.all([searchParams, resolveLegalLocale(searchParams)]);
  return renderLegalPage(
    "report",
    searchParams,
    <ReportContentForm locale={locale} initialUrl={typeof url === "string" ? url.slice(0, 2048) : undefined} />
  );
}
