import type { LegalLocale } from "../locale";
import { SUBPROCESSORS } from "../subprocessors";
import { Table } from "./primitives";

const HEAD: Record<LegalLocale, string[]> = {
  en: ["Provider", "Purpose", "Data", "Location", "Transfer safeguard"],
  it: ["Fornitore", "Finalità", "Dati", "Luogo", "Garanzia per il trasferimento"],
};

export function SubprocessorTable({
  locale,
  bookingOnly = false,
}: {
  locale: LegalLocale;
  // DPA annex: only providers that touch a business's customer data.
  bookingOnly?: boolean;
}) {
  const rows = SUBPROCESSORS.filter((s) => !bookingOnly || s.bookingData).map((s) => [
    <span key="n" className="font-medium text-foreground">
      {s.name}
    </span>,
    s.purpose[locale],
    s.data[locale],
    s.location[locale],
    s.safeguard[locale],
  ]);
  return <Table head={HEAD[locale]} rows={rows} />;
}
