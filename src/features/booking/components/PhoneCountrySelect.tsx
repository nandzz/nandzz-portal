"use client";

import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { PHONE_COUNTRIES, regionName, regionToFlag } from "../domain/phone";

// The one country dial-code selector ("🇮🇹 +39") used next to every phone field
// (booking widget, profile WhatsApp, Orders). Options are sorted by country
// name in the viewer's language. Pair it with a national-number input and
// combine the two with `toE164(dialForRegion(region), national)`.
export function PhoneCountrySelect({
  value,
  onChange,
  disabled,
  className,
  wrapperClassName,
}: {
  /** ISO region, e.g. "IT". */
  value: string;
  onChange: (region: string) => void;
  disabled?: boolean;
  /** Classes for the <select> (border, height, text size). */
  className?: string;
  /** Classes for the wrapper (holds the chevron). */
  wrapperClassName?: string;
}) {
  const { t, locale } = useLanguage();
  const options = useMemo(
    () => [...PHONE_COUNTRIES].sort((a, b) => regionName(a.region, locale).localeCompare(regionName(b.region, locale), locale)),
    [locale],
  );
  return (
    <div className={cn("relative shrink-0", wrapperClassName)}>
      <select
        aria-label={t.booking.phoneCountryAria}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-full cursor-pointer appearance-none bg-transparent pl-3 pr-7 outline-none", className)}
      >
        {options.map((c) => (
          <option key={c.region} value={c.region}>
            {regionToFlag(c.region)} +{c.dial}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
