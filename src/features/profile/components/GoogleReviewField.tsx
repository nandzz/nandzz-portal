"use client";

import { ExternalLink, Star, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GoogleReviewListing } from "@/lib/types";
import { googleReviewUrl } from "../domain/google-review";
import { GoogleListingPicker } from "./GoogleListingPicker";

// Edit-profile field: connect the Google business listing behind the public
// "Leave a Google review" button. Controlled; saved with the dialog's form.
export function GoogleReviewField({
  value,
  onChange,
}: {
  value: GoogleReviewListing | null;
  onChange: (next: GoogleReviewListing | null) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="space-y-2">
      <Label htmlFor="edit-google-review" className="flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        {t.brand.googleReviewTitle}
      </Label>
      {value ? (
        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{value.name}</p>
              {value.address && <p className="truncate text-xs text-muted-foreground">{value.address}</p>}
              <a
                href={googleReviewUrl(value.place_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline dark:text-violet-400"
              >
                <ExternalLink className="h-3 w-3" />
                {t.brand.googleReviewTest}
              </a>
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={t.brand.googleReviewRemove}
              title={t.brand.googleReviewRemove}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t.brand.googleReviewEnabled}</span>
            <Switch
              aria-label={t.brand.googleReviewEnabled}
              checked={value.enabled}
              onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
            />
          </div>
        </div>
      ) : process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ? (
        <GoogleListingPicker
          id="edit-google-review"
          placeholder={t.brand.googleReviewSearchPlaceholder}
          noResultsLabel={t.brand.googleReviewNoResults}
          onPick={(p) => onChange({ place_id: p.placeId, name: p.name, address: p.address || undefined, enabled: true })}
        />
      ) : (
        <p className="text-xs text-muted-foreground">{t.brand.googleReviewUnavailable}</p>
      )}
      <p className="text-xs text-muted-foreground">{t.brand.googleReviewDesc}</p>
    </div>
  );
}
