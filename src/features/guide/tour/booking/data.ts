import type { AvailabilityWindows, CalendarConfig, CalendarService, Location, StaffMember } from "@/lib/types";
import { defaultCalendarConfig } from "@/features/booking/domain/calendar";
import type { GuideTourSample } from "../../content";

// Sample business for the whole tour: Studio Lume, a hair & beauty salon.
// People's names are data; the salon's own words (services, roles…) come from
// the locale (`tour.sample`), and every label from the real components' i18n.
const hours = (from: string, to: string): [string, string][] => [[from, to]];
const week = (days: (keyof AvailabilityWindows)[], from: string, to: string): AvailabilityWindows =>
  Object.fromEntries(days.map((d) => [d, hours(from, to)]));

const MON_SAT = ["mon", "tue", "wed", "thu", "fri", "sat"] as const;

const staffOf = (s: GuideTourSample): StaffMember[] => [
  {
    id: "stf_giulia",
    name: "Giulia",
    info: s.roles.senior,
    availability: week(["mon", "tue", "wed", "thu", "fri"], "09:00", "18:00"),
  },
  {
    id: "stf_marco",
    name: "Marco",
    info: s.roles.barber,
    availability: week(["tue", "wed", "thu", "fri", "sat"], "10:00", "19:00"),
  },
  {
    id: "stf_sara",
    name: "Sara",
    info: s.roles.colourist,
    availability: week(["mon", "wed", "fri", "sat"], "09:00", "17:00"),
  },
];

export const servicesOf = (s: GuideTourSample): CalendarService[] => [
  { id: "svc_cut", name: s.services.cut, duration_min: 45, price_cents: 4000, category_id: "cat_hair" },
  { id: "svc_colour", name: s.services.colour, duration_min: 90, price_cents: 7500, category_id: "cat_hair", staff_ids: ["stf_giulia", "stf_sara"] },
  { id: "svc_blow", name: s.services.blow, duration_min: 30, price_cents: 2500, category_id: "cat_hair" },
  { id: "svc_beard", name: s.services.beard, duration_min: 20, price_cents: 1800, category_id: "cat_barber", staff_ids: ["stf_marco"] },
];

const categoriesOf = (s: GuideTourSample) => [
  { id: "cat_hair", name: s.categories.hair },
  { id: "cat_barber", name: s.categories.barber },
];

export const LOCATION_NAME = "Studio Lume · Centro";

function locationsOf(s: GuideTourSample): Location[] {
  const services = servicesOf(s);
  const categories = categoriesOf(s);
  const staff = staffOf(s);
  return [
  {
    id: "loc_centro",
    name: LOCATION_NAME,
    address: "Via Torino 12, Milano",
    timezone: "Europe/Rome",
    services,
    categories,
    staff,
    availability: week([...MON_SAT], "09:00", "19:00"),
  },
  {
    id: "loc_navigli",
    name: "Studio Lume · Navigli",
    address: "Alzaia Naviglio Grande 40, Milano",
    timezone: "Europe/Rome",
    services: services.slice(0, 3),
    categories,
    staff: staff.slice(0, 2),
    availability: week(["tue", "wed", "thu", "fri", "sat"], "10:00", "19:00"),
  },
  ];
}

export const CURRENT_LOCATION_ID = "loc_centro";

export function buildConfig(s: GuideTourSample): CalendarConfig {
  return {
    ...defaultCalendarConfig(),
    timezone: "Europe/Rome",
    currency: "eur",
    buffer_min: 10,
    locations: locationsOf(s),
  };
}

// Client-side sample: bookable days = the next ~3 weeks, Sundays closed.
export function bookableDates(todayKey: string, days = 21): Set<string> {
  const out = new Set<string>();
  const [y, m, d] = todayKey.split("-").map(Number);
  for (let i = 0; i < days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12));
    if (dt.getUTCDay() !== 0) out.add(dt.toISOString().slice(0, 10));
  }
  return out;
}

export const SAMPLE_TIMES = ["10:00", "10:45", "11:30", "14:00", "15:15", "16:30"];
