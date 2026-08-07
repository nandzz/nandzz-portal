"use client";

import { MapPin, Settings2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Location } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  locations: Location[];
  onSelect: (id: string) => void;
  onManage: () => void;
}

// Landing screen for a multi-location widget's dashboard: pick which
// location every tab (Overview/Bookings/Customers/Staff/Settings) should be
// scoped to before showing them. Only mounted when locations.length > 0 —
// the zero-location legacy path skips straight to the tabs, unchanged.
export function LocationGate({ locations, onSelect, onManage }: Props) {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">{t.booking.chooseLocation}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.booking.locationGateSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {locations.map((l) => {
          const initial = l.name?.trim()?.[0]?.toUpperCase() ?? "?";
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onSelect(l.id)}
              aria-label={t.booking.workingInLocationAria.replace("{name}", l.name || t.booking.unnamedLocation)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left outline-none transition-all hover:border-emerald-400/70 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Avatar size="lg" className="h-12 w-12 shrink-0">
                <AvatarImage src={l.photo_url || undefined} />
                <AvatarFallback className="bg-emerald-100 text-base font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{l.name || t.booking.unnamedLocation}</p>
                <p className="mt-0.5 line-clamp-1 flex items-center gap-1 text-sm text-muted-foreground">
                  {l.address?.trim() ? (
                    <>
                      <MapPin className="h-3 w-3 shrink-0" /> {l.address}
                    </>
                  ) : (
                    t.booking.noAddressSet
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onManage}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <Settings2 className="h-4 w-4" /> {t.booking.manageLocationsLink}
        </button>
      </div>
    </div>
  );
}
