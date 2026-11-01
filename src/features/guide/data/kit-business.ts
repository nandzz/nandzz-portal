import "server-only";
import { fetchPublicProfile, getIsDemoProfile } from "@/features/profile/server";
import { getPublicCalendar } from "@/features/booking/server";
import { normalizeCalendarConfig, timezoneForLocation } from "@/features/booking/domain/calendar";
import type { TourBusiness } from "../tour/business";

// The demo business a /kit/tour capture shows: its own booking setup (first
// location), read like the public booking page reads it. Demo pages only: the
// screens put sample customers next to the business's name, which must never
// happen for a real, claimed business.
export async function getKitBusiness(username: string): Promise<TourBusiness | null> {
  const lower = username.toLowerCase();
  const [profile, isDemo] = await Promise.all([fetchPublicProfile(lower), getIsDemoProfile(lower)]);
  if (!profile || !isDemo) return null;
  const widget = await getPublicCalendar(profile.id);
  if (!widget) return null;
  const config = normalizeCalendarConfig(widget.config);
  const location = config.locations[0];
  if (!location) return null;
  return {
    name: profile.display_name || profile.username,
    username: profile.username,
    avatarUrl: profile.avatar_url ?? null,
    currency: config.currency,
    timezone: timezoneForLocation(config, location.id),
    location,
  };
}
