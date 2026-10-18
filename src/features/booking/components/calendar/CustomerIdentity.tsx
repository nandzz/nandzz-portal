"use client";

import { ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CustomerProfileLink } from "@/features/booking/components/calendar/BookingRow";

// Shared customer identity bits for the owner's booking dashboard: the avatar
// (the linked account's picture, else initials) and the "View profile" link.
// A profile is only ever present when the customer booked while logged in.

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function CustomerAvatar({
  name,
  profile,
  className,
}: {
  name: string;
  profile?: CustomerProfileLink | null;
  className?: string;
}) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={name} />}
      <AvatarFallback className="bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        {initialsOf(name) || "?"}
      </AvatarFallback>
    </Avatar>
  );
}

export function ViewProfileLink({ profile }: { profile: CustomerProfileLink }) {
  const { t } = useLanguage();
  return (
    <a
      href={`/${profile.username}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
    >
      {t.booking.viewProfile}
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </a>
  );
}
