"use client";

import { Trash2, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Location } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  location: Location;
  onOpen: () => void;
  onDelete: () => void;
}

// A compact roster tile: photo + name + address, with a services/staff count
// summary. Mirrors StaffCard — the whole card opens the editor, delete is a
// sibling button (not nested) so the markup stays valid and keyboard-navigable.
export function LocationCard({ location, onOpen, onDelete }: Props) {
  const { t } = useLanguage();
  const initial = location.name?.trim()?.[0]?.toUpperCase() ?? "?";
  const servicesCount = location.services.length;
  const staffCount = location.staff.length;

  return (
    <div className="group relative rounded-2xl border border-border bg-background transition-all hover:border-emerald-400/70 hover:shadow-sm focus-within:border-emerald-400/70">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t.booking.editLocationAria.replace("{name}", location.name || t.booking.unnamedLocation)}
        className="flex w-full flex-col gap-4 rounded-2xl p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <div className="flex items-start gap-3">
          <Avatar size="lg" className="h-12 w-12 shrink-0">
            <AvatarImage src={location.photo_url || undefined} />
            <AvatarFallback className="bg-emerald-100 text-base font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 pr-6">
            <p className="truncate font-medium text-foreground">
              {location.name || t.booking.unnamedLocation}
            </p>
            <p className="mt-0.5 line-clamp-2 flex items-center gap-1 text-sm text-muted-foreground">
              {location.address?.trim() ? (
                <>
                  <MapPin className="h-3 w-3 shrink-0" /> {location.address}
                </>
              ) : (
                t.booking.noAddressSet
              )}
            </p>
          </div>
        </div>

        <span className="text-xs text-muted-foreground">
          {t.booking.locationServicesStaffSummary
            .replace("{services}", String(servicesCount))
            .replace("{staff}", String(staffCount))}
        </span>
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={t.booking.removeLocationAria.replace("{name}", location.name || t.booking.unnamedLocation)}
        title={t.booking.removeTitle}
        className="absolute right-2.5 top-2.5 rounded-lg p-1.5 text-muted-foreground opacity-0 outline-none transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-emerald-400 group-hover:opacity-100 dark:hover:bg-red-950/30"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
