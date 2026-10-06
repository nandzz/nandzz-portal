"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, Clock, Loader2, Check, ChevronLeft, ChevronRight, ChevronDown, Pencil, Sparkles, Tag, MapPin } from "lucide-react";
import type { CalendarCategory, CalendarService, Location, StaffMember } from "@/lib/types";
import { eligibleStaffForService, todayInZone, type Slot } from "@/lib/widgets/calendar";
import { AUTH_RETURN_TO_KEY } from "@/lib/layout/appShell";
import { BOOKING_ERROR_KEYS } from "@/lib/widgets/booking-errors";
import {
  PHONE_COUNTRIES,
  dialForRegion,
  inferPhoneRegion,
  isPossiblePhoneNumber,
  isValidEmail,
  regionName,
  regionToFlag,
  splitE164,
  toE164,
} from "@/lib/widgets/phone";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MonthCalendar, CalendarSkeleton } from "./MonthCalendar";
import { AuthModal, type AuthResult } from "@/features/auth";
import { getBookingViewer, getBookingSession, type BookingViewer } from "../../viewer";
import { useLanguage } from "@/contexts/LanguageContext";

// How far out the calendar lets visitors book. Wider than the old flat list so
// the month grid feels real; the availability API caps `days` at 60.
const BOOKING_WINDOW_DAYS = 60;

interface Props {
  instanceId: string;
  // Multi-location config. Empty ⇒ legacy single-location mode, reading the
  // services/staff/timezone props below exactly as before locations existed.
  locations?: Location[];
  services: CalendarService[];
  // Service groupings for the legacy top-level scope (used only when there are
  // no locations — a chosen location carries its own `categories`). Empty/absent
  // ⇒ services render as one flat list, exactly as before categories existed.
  categories?: CalendarCategory[];
  timezone: string;
  businessName: string;
  // The instance's bookable staff. Empty ⇒ single-resource business and the
  // "choose your specialist" step never appears.
  staff?: StaffMember[];
  // Whether to show service prices to the visitor. Owner-controlled; defaults to
  // shown so callers that don't pass it keep the prior behavior.
  showPrices?: boolean;
  // Symbol prefixed to prices ($, €, £, …). Owner-selected per widget; defaults
  // to "$" so callers that don't pass it keep the prior behavior.
  currencySymbol?: string;
  // Whether to ask the visitor for an address, and whether it's mandatory. Both
  // owner-controlled per instance; default off so callers that don't pass them
  // keep the prior behavior (no address field). `addressRequired` is only
  // meaningful when `collectAddress` is true.
  collectAddress?: boolean;
  addressRequired?: boolean;
  // Show the WhatsApp-reminder consent checkbox (pre-checked). True only when the
  // platform feature and the business's own toggle are both on.
  offerWhatsAppReminder?: boolean;
  initialServiceId?: string;
  onBooked?: (manageUrl: string) => void;
}

type Step = "location" | "service" | "slot" | "staff" | "details" | "done";

export function CalendarBookingFlow({
  instanceId,
  locations = [],
  services: legacyServices,
  categories: legacyCategories = [],
  timezone: businessTimezone,
  businessName,
  staff: legacyStaff = [],
  showPrices = true,
  currencySymbol = "$",
  collectAddress = false,
  addressRequired = false,
  offerWhatsAppReminder = false,
  initialServiceId,
  onBooked,
}: Props) {
  const { t, locale } = useLanguage();

  // The chosen location (only meaningful when `locations` is non-empty). A
  // single location is defaulted silently — no chooser step for it, mirroring
  // the staff step's "skip when there's no real choice" idiom. Two or more
  // locations start the flow at the "location" step instead (see `step` init
  // below); none ⇒ legacy mode, `location` stays null throughout.
  const [location, setLocation] = useState<Location | null>(() =>
    locations.length === 1 ? locations[0] : null
  );

  // Effective services/staff/timezone for the current step of the flow: the
  // chosen location's own subtree once one is picked (or auto-defaulted),
  // empty arrays while a chooser is pending, or the legacy top-level props
  // when the instance has no locations at all — byte-for-byte today's
  // behavior in that last case.
  const services = location ? location.services : locations.length > 0 ? [] : legacyServices;
  const categories = location
    ? location.categories ?? []
    : locations.length > 0
    ? []
    : legacyCategories;
  const staff = location ? location.staff : locations.length > 0 ? [] : legacyStaff;
  const tz = location?.timezone ?? businessTimezone;

  const preselected = initialServiceId
    ? services.find((s) => s.id === initialServiceId) ?? null
    : null;
  // First real step of the flow — used both for the initial `step` and to
  // decide when the back button's leftmost stop has been reached.
  const firstStep: Step = locations.length > 1 ? "location" : "service";
  const [step, setStep] = useState<Step>(() => {
    if (locations.length > 1) return "location";
    return preselected ? "slot" : "service";
  });
  // Multi-service: the visitor can pick several services in one booking; their
  // durations and prices add up. `preselected` (from the AI chat / deep link)
  // seeds a single-service selection.
  const [selectedServices, setSelectedServices] = useState<CalendarService[]>(
    preselected ? [preselected] : []
  );
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Whether the full month grid is showing. Collapses to a compact summary once
  // the visitor actively picks a day (auto-selecting the first day keeps it open).
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [slot, setSlot] = useState<Slot | null>(null);
  // Chosen specialist PER service: { serviceId: staffId }. A missing entry or ""
  // means "any available" for that service (the server auto-assigns a free one).
  const [staffByService, setStaffByService] = useState<Record<string, string>>({});
  // `phone` holds the NATIONAL number only; the country dial code comes from
  // `phoneRegion` and is combined into E.164 at submit time.
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const [phoneRegion, setPhoneRegion] = useState<string>("US");
  // A signed-in visitor whose details we prefilled (drives the "Booking as …"
  // banner); null for guests, who instead see the sign-in CTA.
  const [viewer, setViewer] = useState<BookingViewer | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  // "login" = the guest CTA (log in / sign up); "setup" = finishing an OAuth
  // signup's username step in-modal after returning from Google.
  const [authMode, setAuthMode] = useState<"login" | "setup">("login");
  const [authInitialName, setAuthInitialName] = useState("");
  // Format errors surface only once a field has been left (blur) or on submit,
  // so the visitor isn't scolded mid-typing.
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPhone, setTouchedPhone] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manageUrl, setManageUrl] = useState<string | null>(null);

  // Running totals for the selected services — the summed duration reserves the
  // whole slot, the summed price is what the visitor will pay.
  const totalDuration = selectedServices.reduce((n, s) => n + (s.duration_min || 0), 0);
  const totalPriceCents = selectedServices.reduce((n, s) => n + (s.price_cents ?? 0), 0);
  const anyPriced = selectedServices.some(
    (s) => typeof s.price_cents === "number" && s.price_cents > 0
  );
  const servicesLabel = selectedServices.map((s) => s.name).join(" + ");

  // Per-service specialist step (right after services, before day/time). Shown
  // whenever a selected service has any eligible staff: services with 2+ offer a
  // real choice, services with exactly 1 just tell the visitor who'll do the
  // work (pre-assigned). Services with 0 eligible are left out. `staffStepUsed`
  // drives back-nav. Cheap to recompute each render (O(staff × services)).
  const staffStepServices = selectedServices.filter(
    (s) => eligibleStaffForService(staff, s).length > 0
  );
  const staffChoiceServices = staffStepServices.filter(
    (s) => eligibleStaffForService(staff, s).length > 1
  );
  const staffStepUsed = staffStepServices.length > 0;

  // If a service was preselected (e.g. from the AI chat), load its slots on mount.
  useEffect(() => {
    if (preselected) void loadSlots([preselected]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infer the phone country the same way locale is inferred (browser language →
  // likely region), then prefill contact details if the visitor already has a
  // Nandzz session. Guests just keep the inferred country. Runs once on mount.
  useEffect(() => {
    const inferred = inferPhoneRegion(
      typeof navigator !== "undefined" ? navigator.language : null,
      locale
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync of the phone country from the browser language (an external signal only readable on the client), mirroring LanguageContext's locale detection
    setPhoneRegion(inferred);
    // Returning from an OAuth sign-in mid-booking: put the visitor back on the
    // summary they left. Guests without a snapshot are unaffected.
    restoreSnapshot();
    // We ARE the return target now — drop the return-to marker so it can't send a
    // later /setup-username visit back here.
    try {
      sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
    } catch {
      // ignore
    }
    let active = true;
    void getBookingSession()
      .then(({ viewer: v, needsSetup }) => {
        if (!active) return;
        if (needsSetup) {
          // Returned from an OAuth signup without a username yet — finish that
          // step INSIDE the modal (seeded with the name Google gave us), then
          // continue the booking. No bounce to a separate page.
          setAuthInitialName(v?.name ?? "");
          setAuthMode("setup");
          setAuthOpen(true);
        } else if (v) {
          applyPrefill(v);
        }
      })
      .catch(() => {
        // No session / unavailable auth (guests, SSR-less test env) — just skip
        // prefill; the visitor fills the form themselves.
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fill contact fields from a signed-in viewer (or a fresh signup). Only fills
  // blanks the visitor hasn't typed into, so re-running never clobbers edits;
  // the phone (when present) is split into the country selector + national part.
  function applyPrefill(v: BookingViewer) {
    setViewer(v);
    setForm((f) => ({
      ...f,
      name: f.name || v.name,
      email: f.email || v.email,
      phone: v.phone && !f.phone ? splitE164(v.phone).national : f.phone,
    }));
    if (v.phone) setPhoneRegion(splitE164(v.phone).region);
  }

  // "Not you?" — drop the prefilled identity so someone else can book on a
  // shared device.
  function clearViewer() {
    setViewer(null);
    setForm((f) => ({ ...f, name: "", email: "", phone: "" }));
    setTouchedEmail(false);
    setTouchedPhone(false);
  }

  // Email/password auth resolved in place (no page nav). Prefer the live session
  // (login gives us name/phone too); fall back to what the signup form reported
  // when the session is still pending email confirmation.
  async function handleAuthSuccess(result: AuthResult) {
    setAuthOpen(false);
    setAuthMode("login");
    const v = await getBookingViewer().catch(() => null);
    applyPrefill(v ?? { name: result.displayName, email: result.email, phone: "" });
  }

  // Google is a full-page redirect, so it can't resolve in place — send it back
  // to THIS widget (via the auth callback) so the visitor returns signed in and
  // their details prefill on mount.
  // `modal=1` tells the auth callback this is an in-modal flow: a new OAuth
  // signup should return straight here (to finish the username step in THIS
  // modal), never to the standalone /setup-username page.
  const googleReturnTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          window.location.pathname
        )}&modal=1`
      : undefined;

  // The Google/OAuth path is a full page reload, which would otherwise wipe the
  // visitor's in-progress selection. We snapshot it to sessionStorage just
  // before the redirect and restore it on return, so they land back on the exact
  // same summary (now signed in + prefilled). Keyed per widget instance.
  const snapshotKey = `nandzz.booking.${instanceId}`;

  function saveSnapshot() {
    try {
      // Record where to return after the OAuth round trip so we land back on
      // THIS widget (and finish the username step in-modal) even if the `next`
      // query param doesn't survive Supabase's redirect — see AUTH_RETURN_TO_KEY.
      sessionStorage.setItem(AUTH_RETURN_TO_KEY, window.location.pathname);
    } catch {
      // Non-fatal — the URL `next` param is the fallback path home.
    }
    if (!slot || selectedServices.length === 0) return;
    try {
      sessionStorage.setItem(
        snapshotKey,
        JSON.stringify({
          locationId: location?.id ?? null,
          serviceIds: selectedServices.map((s) => s.id),
          staffByService,
          slot,
        })
      );
    } catch {
      // sessionStorage unavailable (private mode / disabled) — the visitor just
      // re-picks their slot after signing in; no crash.
    }
  }

  // Rehydrate a saved selection by resolving the stored IDs back to the objects
  // in this instance's config, then jump straight to the summary. Returns false
  // (and changes nothing) when there's no valid snapshot to restore.
  function restoreSnapshot(): boolean {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(snapshotKey);
      if (raw) sessionStorage.removeItem(snapshotKey);
    } catch {
      return false;
    }
    if (!raw) return false;
    try {
      const snap = JSON.parse(raw) as {
        locationId: string | null;
        serviceIds: string[];
        staffByService?: Record<string, string>;
        slot: Slot;
      };
      const loc = snap.locationId
        ? locations.find((l) => l.id === snap.locationId) ?? null
        : null;
      const svcPool = loc ? loc.services : locations.length > 0 ? [] : legacyServices;
      const svcs = (snap.serviceIds ?? [])
        .map((id) => svcPool.find((s) => s.id === id))
        .filter((s): s is CalendarService => Boolean(s));
      if (svcs.length === 0 || !snap.slot) return false;
      if (loc) setLocation(loc);
      setSelectedServices(svcs);
      setStaffByService(snap.staffByService ?? {});
      setSlot(snap.slot);
      setStep("details");
      return true;
    } catch {
      return false;
    }
  }

  function fmtDay(iso: string) {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  }
  function fmtTime(iso: string) {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  }
  // Civil date ("YYYY-MM-DD") of an ISO instant in the widget timezone — the key
  // the calendar groups slots by. en-CA yields ISO-ordered output.
  const dateKeyFmt = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    [tz]
  );
  function dateKeyOf(iso: string) {
    return dateKeyFmt.format(new Date(iso));
  }

  // `staffMap` scopes availability per service to the chosen specialist(s); a
  // missing/"" entry leaves that service open to any available staff.
  async function loadSlots(svcs: CalendarService[], staffMap: Record<string, string> = {}) {
    if (svcs.length === 0) return;
    setLoadingSlots(true);
    setError(null);
    setSelectedDate(null);
    setCalendarOpen(true);
    try {
      const params = new URLSearchParams({
        service_ids: svcs.map((s) => s.id).join(","),
        days: String(BOOKING_WINDOW_DAYS),
      });
      const staffParam = svcs.map((s) => `${s.id}:${staffMap[s.id] ?? ""}`).join(",");
      if (staffParam) params.set("staff", staffParam);
      if (location) params.set("location_id", location.id);
      const res = await fetch(`/api/widgets/${instanceId}/availability?${params.toString()}`);
      const data = await res.json();
      setSlots(res.ok ? data.slots ?? [] : []);
      if (!res.ok) setError(t.booking.errorLoadAvailability);
    } catch {
      setError(t.booking.errorLoadAvailability);
    } finally {
      setLoadingSlots(false);
    }
  }

  // Location chosen (only reachable when locations.length > 1 — a single
  // location is auto-defaulted on mount and never shows this step). No "any
  // location" pseudo-option: a booking happens at one physical place.
  function pickLocation(loc: Location) {
    setLocation(loc);
    setSelectedServices([]);
    setSlot(null);
    setStaffByService({});
    setStep("service");
  }

  // Toggle a service in/out of the multi-select. Selection order is preserved so
  // the summary + combined name read in the order the visitor picked them.
  function toggleService(s: CalendarService) {
    setSelectedServices((prev) =>
      prev.some((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s]
    );
  }

  // One selectable service row in the service step — shared by the flat and the
  // category-grouped layouts.
  function renderServiceOption(s: CalendarService) {
    const checked = selectedServices.some((x) => x.id === s.id);
    return (
      <button
        key={s.id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => toggleService(s)}
        className={`w-full text-left rounded-xl border px-4 py-3 transition hover:shadow-sm ${
          checked
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-border bg-background hover:border-emerald-400"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
              checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-border bg-background"
            }`}
          >
            {checked && <Check className="h-3.5 w-3.5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{s.name}</span>
              {showPrices && typeof s.price_cents === "number" && s.price_cents > 0 && (
                <span className="text-sm text-muted-foreground">
                  {currencySymbol}
                  {(s.price_cents / 100).toFixed(2)}
                </span>
              )}
            </div>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {t.booking.durationMin.replace("{min}", String(s.duration_min))}
            </span>
          </div>
        </div>
      </button>
    );
  }

  // The service list, grouped under category headers when the scope has
  // categories that any service actually uses. Falls back to a flat list
  // otherwise — byte-for-byte the pre-categories rendering.
  function renderServiceList() {
    const catIds = new Set(categories.map((c) => c.id));
    const activeCats = categories.filter((cat) => services.some((s) => s.category_id === cat.id));
    if (activeCats.length === 0) return <>{services.map(renderServiceOption)}</>;
    const uncategorized = services.filter((s) => !s.category_id || !catIds.has(s.category_id));
    return (
      <>
        {activeCats.map((cat) => (
          <div key={cat.id} className="space-y-2">
            <p className="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {cat.name?.trim()}
            </p>
            {services.filter((s) => s.category_id === cat.id).map(renderServiceOption)}
          </div>
        ))}
        {uncategorized.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.booking.uncategorized}
            </p>
            {uncategorized.map(renderServiceOption)}
          </div>
        )}
      </>
    );
  }

  // Continue from the service step once at least one service is chosen. When any
  // selected service offers a real specialist choice (2+ eligible staff), the
  // visitor picks per-service FIRST (staff step) so availability reflects those
  // choices; otherwise there's no real choice, so we go straight to day/time.
  async function proceedFromServices() {
    if (selectedServices.length === 0) return;
    setSlot(null);
    // Services with a single eligible specialist are pre-assigned to them.
    const preset: Record<string, string> = {};
    let needsStaff = false;
    for (const s of selectedServices) {
      const eligible = eligibleStaffForService(staff, s);
      if (eligible.length > 0) needsStaff = true;
      if (eligible.length === 1) preset[s.id] = eligible[0].id;
    }
    setStaffByService(preset);
    if (needsStaff) {
      setStep("staff");
      return;
    }
    setStep("slot");
    await loadSlots(selectedServices, {});
  }

  // Set the chosen specialist for one service ("" = any available).
  function setServiceStaff(serviceId: string, id: string) {
    setStaffByService((prev) => ({ ...prev, [serviceId]: id }));
  }

  // Continue from the per-service staff step → scope availability to the choices.
  async function proceedFromStaff() {
    setStep("slot");
    await loadSlots(selectedServices, staffByService);
  }

  // Time-slot picked → straight to details; the specialist (if any) was already
  // chosen before this step.
  function pickSlot(s: Slot) {
    setSlot(s);
    setStep("details");
  }

  async function submit() {
    if (selectedServices.length === 0 || !slot) return;
    // Email is optional: without one the customer just gets no confirmation /
    // reminder emails and keeps the manage link shown on the done step.
    if (!form.name.trim() || !form.phone.trim()) {
      setError(t.booking.errorRequiredFields);
      return;
    }
    if (form.email.trim() && !isValidEmail(form.email)) {
      setTouchedEmail(true);
      setError(t.booking.invalidEmail);
      return;
    }
    if (!isPossiblePhoneNumber(form.phone)) {
      setTouchedPhone(true);
      setError(t.booking.invalidPhone);
      return;
    }
    // Address is only validated when the owner both collects it and marks it
    // required — otherwise it's optional (or absent entirely).
    if (collectAddress && addressRequired && !form.address.trim()) {
      setError(t.booking.errorRequiredFields);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/widgets/${instanceId}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_ids: selectedServices.map((s) => s.id),
          starts_at: slot.start,
          staff_by_service: staffByService,
          location_id: location ? location.id : undefined,
          customer_name: form.name,
          customer_email: form.email.trim() || undefined,
          customer_phone: toE164(dialForRegion(phoneRegion), form.phone),
          customer_address: collectAddress ? form.address.trim() || undefined : undefined,
          notes: form.notes || undefined,
          whatsapp_opt_in: offerWhatsAppReminder ? whatsappOptIn : false,
          // The language the customer actually used the widget in (picker or
          // browser-default cookie) — authoritative over Accept-Language, which
          // can be English even for a booker in a non-English locale.
          locale,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const key = BOOKING_ERROR_KEYS[data.error as string] as keyof typeof t.booking | undefined;
        setError(key ? t.booking[key] : t.booking.errorGeneric);
        return;
      }
      setManageUrl(data.manage_url);
      setStep("done");
      onBooked?.(data.manage_url);
    } catch {
      setError(t.booking.errorBookingFailed);
    } finally {
      setSubmitting(false);
    }
  }

  // Group slots by civil date (in the widget tz) for the calendar + time picker.
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = dateKeyOf(s.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // Slots arrive chronologically from the API, so each day's list already is.
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, tz]);

  const availableDates = useMemo(() => new Set(slotsByDate.keys()), [slotsByDate]);

  // Calendar bounds: today (owner tz) through the end of the booking window.
  const minDate = useMemo(() => todayInZone(tz), [tz]);
  const maxDate = useMemo(() => {
    const [y, m, d] = minDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + BOOKING_WINDOW_DAYS - 1, 12))
      .toISOString()
      .slice(0, 10);
  }, [minDate]);

  // Land on the first bookable date so the time picker isn't empty on arrival —
  // derived, not stored, until the visitor picks one (`selectedDate`) themselves.
  const firstAvailable = useMemo(
    () => [...availableDates].sort()[0] ?? null,
    [availableDates]
  );
  const activeDate = selectedDate ?? firstAvailable;

  const daySlots = activeDate ? slotsByDate.get(activeDate) ?? [] : [];
  const activeDateLabel = activeDate ? fmtDay(`${activeDate}T12:00:00Z`) : "";

  // Visitor actively chose a day → collapse the grid into the summary bar.
  function pickDate(key: string) {
    setSelectedDate(key);
    setCalendarOpen(false);
  }

  // The chosen specialist for a service (null ⇒ any available), used in the
  // summary — carries the photo so the row can show their avatar.
  const chosenStaffFor = (serviceId: string): StaffMember | null => {
    const id = staffByService[serviceId];
    return id ? staff.find((m) => m.id === id) ?? null : null;
  };

  // Contact-field format state — only "bad" once the visitor has typed
  // something; empties are handled by the required-fields check on submit.
  const emailFormatBad = form.email.trim() !== "" && !isValidEmail(form.email);
  const phoneFormatBad = form.phone.trim() !== "" && !isPossiblePhoneNumber(form.phone);

  // Country options for the phone prefix, sorted by their localized name so the
  // list reads naturally in the visitor's language.
  const phoneCountryOptions = useMemo(
    () =>
      [...PHONE_COUNTRIES].sort((a, b) =>
        regionName(a.region, locale).localeCompare(regionName(b.region, locale), locale)
      ),
    [locale]
  );

  const back = () => {
    setError(null);
    // Order: [location] → service → [staff] → slot → details. Optional steps are
    // skipped in reverse exactly as they were skipped on the way in.
    if (step === "details") setStep("slot");
    // From the slot step, return to the specialist step only when it was shown.
    else if (step === "slot") setStep(staffStepUsed ? "staff" : "service");
    else if (step === "staff") setStep("service");
    // From service, return to the location chooser only when it was shown
    // (locations.length > 1) — mirrors the staff step's skip symmetry.
    else if (step === "service" && locations.length > 1) setStep("location");
  };

  return (
    <div className="space-y-4">
      {step !== firstStep && step !== "done" && (
        <button
          onClick={back}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> {t.booking.back}
        </button>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {/* Step 0 — location (only when there's a real choice: locations.length > 1).
          A single location is auto-defaulted and never reaches this step; no
          "any location" pseudo-option — a booking happens at one physical place. */}
      {step === "location" && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t.booking.chooseLocation}</h3>
          {locations.map((loc, i) => (
            <button
              key={loc.id}
              onClick={() => pickLocation(loc)}
              style={{ animationDelay: `${i * 60}ms` }}
              className="group w-full text-left rounded-xl border border-border bg-background px-4 py-3 transition hover:border-emerald-400 hover:shadow-sm active:scale-[0.99] animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 motion-reduce:animate-none"
            >
              <div className="flex items-center gap-3">
                <Avatar size="lg" className="shrink-0">
                  <AvatarImage src={loc.photo_url || undefined} alt={loc.name} />
                  <AvatarFallback>{loc.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{loc.name}</span>
                  {loc.address && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {loc.address}
                    </span>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-500 motion-reduce:transition-none" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Step 1 — service (multi-select: pick one or more; totals add up) */}
      {step === "service" && (
        <div className="space-y-2">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{t.booking.chooseService}</h3>
            <p className="text-xs text-muted-foreground">{t.booking.selectServicesHint}</p>
          </div>
          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">{t.booking.noServicesAvailable}</p>
          )}
          {renderServiceList()}

          {selectedServices.length > 0 && (
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3">
                <span className="text-sm font-medium">{t.booking.total}</span>
                <span className="inline-flex items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {t.booking.durationMin.replace("{min}", String(totalDuration))}
                  </span>
                  {showPrices && anyPriced && (
                    <span className="font-semibold tabular-nums">
                      {currencySymbol}
                      {(totalPriceCents / 100).toFixed(2)}
                    </span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={proceedFromServices}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                {t.booking.continue}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — date + time (availability scoped to the chosen specialist) */}
      {step === "slot" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">
            {t.booking.pickDateTime.replace("{service}", servicesLabel)}
          </h3>
          {loadingSlots ? (
            <CalendarSkeleton />
          ) : availableDates.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t.booking.noOpenSlots.replace("{days}", String(BOOKING_WINDOW_DAYS))}
            </p>
          ) : (
            <>
              {calendarOpen ? (
                <MonthCalendar
                  availableDates={availableDates}
                  selected={activeDate}
                  onSelect={pickDate}
                  minDate={minDate}
                  maxDate={maxDate}
                  countFor={(key) => slotsByDate.get(key)?.length ?? 0}
                />
              ) : (
                <button
                  onClick={() => setCalendarOpen(true)}
                  aria-label={t.booking.selectedDateChange.replace("{date}", activeDateLabel)}
                  className="cursor-pointer flex w-full items-center justify-between rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 text-left transition hover:border-emerald-400"
                >
                  <span className="flex items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium">{activeDateLabel}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                    <Pencil className="h-3.5 w-3.5" /> {t.booking.change}
                  </span>
                </button>
              )}

              <div>
                {activeDate ? (
                  <>
                    {calendarOpen && (
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {activeDateLabel}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {daySlots.map((s) => {
                        const active = slot?.start === s.start;
                        return (
                          <button
                            key={s.start}
                            aria-pressed={active}
                            onClick={() => pickSlot(s)}
                            className={`rounded-lg border px-2 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                              active
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "border-border hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            }`}
                          >
                            {fmtTime(s.start)}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{t.booking.selectDateToSeeTimes}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2 — specialist PER SERVICE (shown right after services, before
          day/time, only when some service has 2+ eligible staff). Each service
          picks its own specialist (or "Any available"); availability is then
          computed for the combined per-service choices. */}
      {step === "staff" && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">
              {staffChoiceServices.length > 0 ? t.booking.chooseSpecialist : t.booking.summarySpecialist}
            </h3>
            {staffChoiceServices.length > 0 && (
              <p className="text-sm text-muted-foreground">{t.booking.specialistPerServiceHint}</p>
            )}
          </div>

          {staffStepServices.map((svc) => {
            const eligible = eligibleStaffForService(staff, svc);
            const current = staffByService[svc.id] ?? "";
            // Single eligible specialist — no choice, just say who'll do it.
            if (eligible.length === 1) {
              const m = eligible[0];
              return (
                <div key={svc.id} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {svc.name}
                  </p>
                  <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={m.photo_url || undefined} alt={m.name} />
                      <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {t.booking.specialistAvailable.replace("{name}", m.name)}
                      </span>
                    </span>
                  </div>
                </div>
              );
            }
            return (
              <div key={svc.id} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                <p className="px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {svc.name}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {/* Any available — the server auto-assigns a free specialist. */}
                  <button
                    type="button"
                    aria-pressed={current === ""}
                    onClick={() => setServiceStaff(svc.id, "")}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                      current === ""
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-border bg-background hover:border-emerald-400"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                      <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <span className="min-w-0 text-sm font-medium">{t.booking.anyAvailable}</span>
                  </button>

                  {eligible.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={current === m.id}
                      onClick={() => setServiceStaff(svc.id, m.id)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition ${
                        current === m.id
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                          : "border-border bg-background hover:border-emerald-400"
                      }`}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={m.photo_url || undefined} alt={m.name} />
                        <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{m.name}</span>
                        {m.info && (
                          <span className="block truncate text-xs text-muted-foreground">{m.info}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={proceedFromStaff}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {t.booking.continue}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Step 4 — details */}
      {step === "details" && slot && (
        <div className="space-y-3">
          {/* Faster-checkout affordance: a signed-in visitor sees "Booking as …"
              (details already prefilled); a guest sees a prominent, attention-
              calling prompt to sign in / sign up and autofill — without leaving
              this booking. */}
          {viewer ? (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/30">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                <Check className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  {t.booking.bookingAs.replace("{name}", viewer.name || viewer.email)}
                </span>
                {viewer.name && viewer.email && (
                  <span className="block truncate text-xs text-emerald-700/90 dark:text-emerald-300/80">
                    {viewer.email}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={clearViewer}
                className="shrink-0 rounded-full border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
              >
                {t.booking.notYou}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthOpen(true);
              }}
              className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3.5 text-left text-white shadow-md shadow-emerald-600/20 ring-1 ring-inset ring-white/10 transition hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.99] dark:from-emerald-600 dark:to-teal-600 motion-reduce:active:scale-100"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold leading-tight">
                  {t.booking.signInFasterTitle}
                </span>
                <span className="mt-0.5 block truncate text-xs text-white/90">
                  {t.booking.signInFaster}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition group-hover:bg-emerald-50">
                {t.booking.signInCta}
              </span>
            </button>
          )}

          {/* Booking summary — a clear recap of every choice made so far, so the
              visitor confirms exactly what they're booking before contact details. */}
          <div className="overflow-hidden rounded-xl border border-border bg-muted/40 divide-y divide-border/70">
            {selectedServices.map((s) => (
              <SummaryRow
                key={s.id}
                icon={<Tag className="h-4 w-4" />}
                label={t.booking.summaryService}
                value={s.name}
                meta={[
                  t.booking.durationMin.replace("{min}", String(s.duration_min)),
                  showPrices && typeof s.price_cents === "number" && s.price_cents > 0
                    ? `${currencySymbol}${(s.price_cents / 100).toFixed(2)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
            {selectedServices.length > 1 && (
              <SummaryRow
                icon={<Tag className="h-4 w-4" />}
                label={t.booking.total}
                value={t.booking.durationMin.replace("{min}", String(totalDuration))}
                meta={showPrices && anyPriced ? `${currencySymbol}${(totalPriceCents / 100).toFixed(2)}` : null}
              />
            )}
            <SummaryRow
              icon={<CalendarDays className="h-4 w-4" />}
              label={t.booking.summaryWhen}
              value={fmtDay(slot.start)}
              meta={fmtTime(slot.start)}
            />
            {staffStepServices.map((svc) => {
              const m = chosenStaffFor(svc.id);
              return (
                <SummaryRow
                  key={`specialist-${svc.id}`}
                  icon={
                    m ? (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.photo_url || undefined} alt={m.name} />
                        <AvatarFallback>{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )
                  }
                  bareIcon={!!m}
                  label={t.booking.summarySpecialist}
                  value={m ? m.name : t.booking.anyAvailable}
                  meta={selectedServices.length > 1 ? svc.name : null}
                />
              );
            })}
            {location && (
              <SummaryRow
                icon={<MapPin className="h-4 w-4" />}
                label={t.booking.summaryLocation}
                value={location.name}
                meta={location.address || null}
              />
            )}
          </div>

          <h3 className="pt-1 text-sm font-semibold">{t.booking.yourDetails}</h3>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={t.booking.fullNamePlaceholder}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div>
            <input
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm ${
                touchedEmail && emailFormatBad ? "border-red-400 dark:border-red-500" : "border-border"
              }`}
              placeholder={t.booking.manualEmailOptionalPlaceholder}
              type="email"
              autoComplete="email"
              aria-invalid={touchedEmail && emailFormatBad}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouchedEmail(true)}
            />
            {touchedEmail && emailFormatBad && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t.booking.invalidEmail}</p>
            )}
          </div>
          <div>
            <div className="flex gap-2">
              {/* Country dial-code prefix — defaulted from the visitor's inferred
                  region, so the common case needs no interaction. */}
              <div className="relative shrink-0">
                <select
                  aria-label={t.booking.phoneCountryAria}
                  value={phoneRegion}
                  onChange={(e) => setPhoneRegion(e.target.value)}
                  className="h-full appearance-none rounded-lg border border-border bg-background py-2 pl-3 pr-7 text-sm"
                >
                  {phoneCountryOptions.map((c) => (
                    <option key={c.region} value={c.region}>
                      {regionToFlag(c.region)} +{c.dial}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
              <input
                className={`w-full rounded-lg border bg-background px-3 py-2 text-sm ${
                  touchedPhone && phoneFormatBad ? "border-red-400 dark:border-red-500" : "border-border"
                }`}
                placeholder={t.booking.phonePlaceholder}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                aria-invalid={touchedPhone && phoneFormatBad}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onBlur={() => setTouchedPhone(true)}
              />
            </div>
            {touchedPhone && phoneFormatBad && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{t.booking.invalidPhone}</p>
            )}
          </div>
          {collectAddress && (
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder={
                addressRequired
                  ? t.booking.customerAddressPlaceholder
                  : t.booking.customerAddressPlaceholderOptional
              }
              autoComplete="street-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          )}
          <textarea
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder={t.booking.notesPlaceholder}
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          {offerWhatsAppReminder && (
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
              />
              <span>{t.booking.whatsappOptIn}</span>
            </label>
          )}
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t.booking.confirmBooking}
          </button>
        </div>
      )}

      {/* Step 5 — done */}
      {step === "done" && (
        <div className="space-y-3 text-center py-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold">{t.booking.bookedTitle}</h3>
          {selectedServices.length === 1 && chosenStaffFor(selectedServices[0].id) && (
            <p className="text-sm font-medium">
              {t.booking.withName.replace("{name}", chosenStaffFor(selectedServices[0].id)!.name)}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {form.email.trim()
              ? t.booking.confirmationSent.replace("{email}", form.email.trim())
              : t.booking.bookedNoEmail}
          </p>
          {/* Signed-in bookers get a direct route into their bookings section;
              guests keep just the manage link (their booking lives at the token
              URL emailed to them). */}
          {viewer && (
            <Link
              href="/dashboard/bookings"
              className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              {t.booking.viewMyBookings}
            </Link>
          )}
          {manageUrl && (
            <a
              href={manageUrl}
              className="inline-block text-sm font-medium text-emerald-600 hover:underline"
            >
              {t.booking.manageBookingLink}
            </a>
          )}
        </div>
      )}

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={handleAuthSuccess}
        onGoogleRedirect={saveSnapshot}
        subtitle={authMode === "setup" ? undefined : t.booking.signInModalSubtitle}
        defaultMode={authMode}
        // The username ("setup") step is reached two ways inside this modal —
        // returning from Google (authMode="setup") and finishing an email/password
        // signup in place — so the booking-worded CTA is always supplied; it's
        // ignored on the login/signup steps.
        ctaLabel={t.booking.continueBooking}
        initialDisplayName={authMode === "setup" ? authInitialName : undefined}
        googleRedirectTo={googleReturnTo}
      />

      <p className="pt-2 text-center text-[10px] text-muted-foreground">
        {t.booking.poweredBy.replace("{business}", businessName).replace("{tz}", tz)}
      </p>
    </div>
  );
}

// One line of the booking summary: an icon, a muted label, the chosen value, and
// an optional trailing detail (duration/price, time, address). Kept dumb and
// presentational so the details step reads as a simple list of rows.
function SummaryRow({
  icon,
  bareIcon = false,
  label,
  value,
  meta,
}: {
  icon: ReactNode;
  // When true the icon renders as-is (e.g. an Avatar, already a circle) instead
  // of being wrapped in the emerald badge used for lucide glyphs.
  bareIcon?: boolean;
  label: string;
  value: string;
  meta?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      {bareIcon ? (
        <span className="shrink-0">{icon}</span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
      {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
    </div>
  );
}
