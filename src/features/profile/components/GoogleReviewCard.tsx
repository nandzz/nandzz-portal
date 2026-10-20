"use client";

import { useState } from "react";
import { ExternalLink, Star, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GoogleReviewListing } from "@/lib/types";
import { updateGoogleReview } from "../actions/update-google-review";
import { googleReviewUrl } from "../domain/google-review";
import { GoogleListingPicker } from "./GoogleListingPicker";

// Brand-page card: connect the Google business listing behind the public
// "Leave a Google review" button. Saves on every change (independent of the
// brand form's Save button).
export function GoogleReviewCard({ initial }: { initial: GoogleReviewListing | null }) {
  const { t } = useLanguage();
  const [listing, setListing] = useState<GoogleReviewListing | null>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(next: GoogleReviewListing | null) {
    const prev = listing;
    setListing(next);
    setSaving(true);
    setError("");
    const result = await updateGoogleReview(next);
    setSaving(false);
    if (!result.ok) {
      setListing(prev);
      setError(t.common.error);
      return;
    }
    window.dispatchEvent(new CustomEvent("profile-updated"));
  }

  return (
    <Card className="mt-6 w-full shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Star className="h-5 w-5 text-amber-500" />
          {t.brand.googleReviewTitle}
        </CardTitle>
        <CardDescription>{t.brand.googleReviewDesc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {listing ? (
          <>
            <div className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{listing.name}</p>
                {listing.address && (
                  <p className="truncate text-sm text-muted-foreground">{listing.address}</p>
                )}
                <a
                  href={googleReviewUrl(listing.place_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm text-violet-600 hover:underline dark:text-violet-400"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t.brand.googleReviewTest}
                </a>
              </div>
              <button
                type="button"
                onClick={() => save(null)}
                disabled={saving}
                aria-label={t.brand.googleReviewRemove}
                title={t.brand.googleReviewRemove}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="googleReviewEnabled">{t.brand.googleReviewEnabled}</Label>
              <Switch
                id="googleReviewEnabled"
                checked={listing.enabled}
                disabled={saving}
                onCheckedChange={(checked) => save({ ...listing, enabled: checked })}
              />
            </div>
          </>
        ) : process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY ? (
          <div className="space-y-2">
            <Label htmlFor="googleListingSearch">{t.brand.googleReviewSearchLabel}</Label>
            <GoogleListingPicker
              id="googleListingSearch"
              placeholder={t.brand.googleReviewSearchPlaceholder}
              noResultsLabel={t.brand.googleReviewNoResults}
              onPick={(p) =>
                save({ place_id: p.placeId, name: p.name, address: p.address || undefined, enabled: true })
              }
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t.brand.googleReviewUnavailable}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
