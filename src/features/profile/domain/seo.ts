import type { Locale } from "@/lib/i18n/translations";
import type { CalendarConfig, CalendarService, Profile, WidgetInstanceWithCatalog } from "@/lib/types";
import { businessCategoryLabel, isBusinessCategory, type BusinessCategory } from "./business-category";
import { buildSocialLinks } from "../components/SocialLinkButtons";

const BASE_URL = "https://nandzz.com";
const META_DESCRIPTION_MAX = 160;

// Most specific schema.org LocalBusiness subtype per category; anything not
// listed is a plain LocalBusiness.
const SCHEMA_TYPES: Partial<Record<BusinessCategory, string>> = {
  hair_salon: "HairSalon",
  barber: "HairSalon",
  beauty: "BeautySalon",
  spa_massage: "DaySpa",
  tattoo_piercing: "TattooParlor",
  fitness: "ExerciseGym",
  yoga_pilates: "SportsActivityLocation",
  medical: "MedicalClinic",
  dental: "Dentist",
  physiotherapy: "Physiotherapy",
  psychology: "MedicalBusiness",
  nutrition: "MedicalBusiness",
  pet_care: "LocalBusiness",
  photography: "ProfessionalService",
  education: "EducationalOrganization",
  consulting: "ProfessionalService",
  home_services: "HomeAndConstructionBusiness",
  automotive: "AutomotiveBusiness",
  retail: "Store",
};

type SeoProfile = Pick<
  Profile,
  | "username"
  | "display_name"
  | "account_type"
  | "category"
  | "tagline"
  | "bio"
  | "avatar_url"
  | "background_url"
  | "address"
  | "website_url"
  | "social_links"
>;

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:·-]+$/, "")}…`;
}

// "Via Roma 1, 20121 Milano MI, Italy" → "Via Roma 1, 20121 Milano MI": the
// country adds nothing to a snippet and eats the character budget.
function shortAddress(formatted: string): string {
  const parts = formatted.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.length > 2 ? parts.slice(0, -1).join(", ") : parts.join(", ");
}

function categoryLabel(profile: SeoProfile, locale: Locale): string | null {
  if (profile.account_type !== "business" || !isBusinessCategory(profile.category)) return null;
  if (profile.category === "other") return null;
  return businessCategoryLabel(profile.category, locale);
}

// Search snippet for a profile: the owner's tagline when set; otherwise a
// business gets "<category> · <address> · <name> on Nandzz." followed by its
// bio, so a page without a tagline still says what and where it is.
export function profileMetaDescription(
  profile: SeoProfile,
  locale: Locale,
  t: { businessTemplate: string; fallbackTemplate: string },
): string {
  const name = profile.display_name || profile.username;
  if (profile.tagline?.trim()) return truncate(profile.tagline, META_DESCRIPTION_MAX);

  const details = [
    categoryLabel(profile, locale),
    profile.account_type === "business" && profile.address?.formatted
      ? shortAddress(profile.address.formatted)
      : null,
  ].filter(Boolean);
  const bio = profile.bio?.trim();

  if (details.length > 0) {
    const lead = t.businessTemplate.replace("{details}", details.join(" · ")).replace("{name}", name);
    return truncate(bio ? `${lead} ${bio}` : lead, META_DESCRIPTION_MAX);
  }
  if (bio) return truncate(bio, META_DESCRIPTION_MAX);
  return t.fallbackTemplate.replace("{name}", name);
}

function bookableServices(widgets: WidgetInstanceWithCatalog[]): {
  services: CalendarService[];
  currency: string;
  showPrices: boolean;
} | null {
  const calendar = widgets.find((w) => w.catalog.slug === "calendar" && w.enabled && w.has_access);
  if (!calendar) return null;
  const config = calendar.config as Partial<CalendarConfig>;
  const services = config.locations?.length
    ? config.locations.flatMap((l) => l.services ?? [])
    : (config.services ?? []);
  // Same service offered at several locations → list it once.
  const seen = new Set<string>();
  const unique = services.filter((s) => {
    const key = s.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    services: unique,
    currency: (config.currency || "eur").toUpperCase(),
    showPrices: config.show_prices ?? false,
  };
}

// schema.org LocalBusiness for a business profile, so search engines can show
// it in local results (name, category, address, map pin, socials, services).
// Personal profiles get nothing.
export function buildProfileJsonLd(
  profile: SeoProfile,
  widgets: WidgetInstanceWithCatalog[],
): Record<string, unknown> | null {
  if (profile.account_type !== "business") return null;

  const url = `${BASE_URL}/${profile.username}`;
  const name = profile.display_name || profile.username;
  const description = profile.tagline?.trim() || profile.bio?.trim();
  const sameAs = buildSocialLinks(profile)
    .map((l) => l.href)
    .filter((href) => /^https?:\/\//i.test(href));
  const booking = bookableServices(widgets);
  const address = profile.address;
  const type = (isBusinessCategory(profile.category) && SCHEMA_TYPES[profile.category]) || "LocalBusiness";

  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#business`,
    name,
    url,
    ...(description && { description: truncate(description, 300) }),
    ...(profile.avatar_url && { logo: profile.avatar_url }),
    image: [profile.avatar_url, profile.background_url].filter(Boolean),
    ...(address?.formatted && { address: address.formatted }),
    ...(typeof address?.lat === "number" &&
      typeof address?.lng === "number" && {
        geo: { "@type": "GeoCoordinates", latitude: address.lat, longitude: address.lng },
      }),
    ...(address?.place_id && {
      hasMap: `https://www.google.com/maps/place/?q=place_id:${address.place_id}`,
    }),
    ...(sameAs.length > 0 && { sameAs }),
    ...(booking &&
      booking.services.length > 0 && {
        potentialAction: {
          "@type": "ReserveAction",
          target: { "@type": "EntryPoint", urlTemplate: `${url}/booking` },
        },
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name,
          itemListElement: booking.services.slice(0, 50).map((s) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name: s.name },
            ...(booking.showPrices &&
              typeof s.price_cents === "number" && {
                price: (s.price_cents / 100).toFixed(2),
                priceCurrency: booking.currency,
              }),
          })),
        },
      }),
  };
}
