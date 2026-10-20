"use client";

import { Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GoogleReviewListing } from "@/lib/types";
import { googleReviewUrl } from "../domain/google-review";

// Public-profile chip that opens Google's "rate and review" dialog for the
// business listing. Same chip look as AddressMenu so they sit side by side.
export function GoogleReviewButton({ listing, style }: { listing: GoogleReviewListing; style?: React.CSSProperties }) {
  const { t } = useLanguage();
  return (
    <a
      href={googleReviewUrl(listing.place_id)}
      target="_blank"
      rel="noopener noreferrer"
      style={style}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/50 bg-background px-3 py-1.5 text-sm text-muted-foreground transition-[color,box-shadow,transform] duration-150 ease-out hover:text-violet-600 hover:shadow-sm active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:hover:text-violet-400"
    >
      <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
      <span className="truncate">{t.profile.leaveGoogleReview}</span>
    </a>
  );
}
