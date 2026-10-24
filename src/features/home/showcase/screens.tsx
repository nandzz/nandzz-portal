"use client";

import { useEffect, useState, type ComponentType, type CSSProperties, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpRight,
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Mail,
  MapPin,
  RotateCcw,
  Share2,
  Sparkles,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import { InstagramIcon, YoutubeIcon } from "@/features/profile/components/BrandIcons";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import type { ShowcaseCopy } from "./content";
import { GALLERY_SIZES, PHOTOS, Photo, type PhotoId } from "./Photo";
import { EASE_OUT, TAP_LAND, TapRing, StatusBar, still, useReduceMotion } from "./phone";
import { SLIDES } from "./slides";

// Every screen mirrors a real Nandzz surface — keep them truthful:
//   profile  → src/app/[username]/(profile)/page.tsx + ProfileHeader (header
//              order: avatar · name · @handle · [book] · bio · [book] · address ·
//              followers · social links · [book]), then Gallery / Publications /
//              Links sections. There is NO services list on the public profile.
//   booking  → Book now opens /[username]/booking (CalendarBookingFlow):
//              service (multi) → specialist → date & time → details → done.
//   style    → ProfileStylePicker (Page / Buttons / Booking tabs).

type Mock = ShowcaseCopy["mock"];
type ScreenVars = Partial<
  Record<"--s-bg" | "--s-surface" | "--s-text" | "--s-muted" | "--s-btn" | "--s-btn-text" | "--s-accent" | "--s-cover", string>
>;

export type ScreenProps = {
  step: number;
  scrollY: number;
  rootRef: Ref<HTMLDivElement>;
  mock: Mock;
};

/* ───────────────────────── Themes ───────────────────────── */

// A custom page color locks the profile to light/dark by its luminance (like
// ProfileStyleRoot) and drops the default violet glow (`--s-cover`), so these
// palettes set every var. The rest follow the site theme via `.showcase-screen`.
const SAGE: ScreenVars = {
  "--s-bg": "#e8eee4",
  "--s-surface": "#dce5d6",
  "--s-text": "#22301f", // owner text color (Style → Page → Text)
  "--s-muted": "rgb(34 48 31 / 0.62)",
  "--s-btn": "#ffffff",
  "--s-btn-text": "#22301f",
  "--s-accent": "#16a34a",
  "--s-cover": "transparent",
};
const NOIR: ScreenVars = {
  "--s-bg": "#121014",
  "--s-surface": "#1d1a20",
  "--s-text": "#f3eee9",
  "--s-muted": "rgb(243 238 233 / 0.6)",
  "--s-btn": "rgb(255 255 255 / 0.08)",
  "--s-btn-text": "#f3eee9",
  "--s-accent": "#f59e0b",
  "--s-cover": "transparent",
};
// Style picker presets (ProfileStylePicker BG_PRESETS / BTN_PRESETS / BOOKING_PRESETS).
const BG_PRESETS = ["#ffffff", "#faf5ff", "#fdf2f8", "#fff1f2", "#fffbeb", "#f0fdf4", "#ecfeff", "#eff6ff", "#faf9f6", "#f5f5f4", "#1e1b2e", "#0f172a"];
const BTN_PRESETS = ["#ffffff", "#111827", "#7c3aed", "#2563eb", "#0891b2", "#16a34a", "#e11d48", "#ea580c", "#f59e0b", "#334155", "#f1f5f9", "#fce7f3"];
const PINK_BG = 2; // "Pink" #fdf2f8
const ROSE_BTN = 6; // "Rose" #e11d48
const BLUSH: ScreenVars = {
  "--s-bg": BG_PRESETS[PINK_BG],
  "--s-surface": "#f9e3ee",
  "--s-text": "#1d1a26", // light lock, default text color
  "--s-muted": "rgb(29 26 38 / 0.58)",
  "--s-btn": "#ffffff",
  "--s-btn-text": "#1d1a26",
  "--s-cover": "transparent",
};
const EMERALD = "#059669"; // booking flow accent (emerald-600), independent of the profile style

/* ───────────────────────── Building blocks ───────────────────────── */

function ScreenRoot({
  vars,
  scrollY,
  rootRef,
  children,
  overlay,
}: {
  vars?: ScreenVars;
  scrollY: number;
  rootRef: Ref<HTMLDivElement>;
  children: ReactNode;
  overlay?: ReactNode;
}) {
  return (
    // `showcase-vars` eases the palette vars themselves, so every color built
    // on them (text, muted text, the top tint) changes in step.
    <div className="showcase-vars absolute inset-0 bg-(--s-bg) text-(--s-text)" style={vars as CSSProperties}>
      <StatusBar />
      <div
        ref={rootRef}
        className="showcase-scroll relative pb-10"
        style={{ transform: `translateY(${-scrollY}px)` }}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[130px] bg-[linear-gradient(180deg,var(--s-cover),transparent)]"
        />
        {children}
      </div>
      {overlay}
    </div>
  );
}

type SocialKey = "website" | "instagram" | "email" | "youtube" | "whatsapp";
type SocialLayout = "icons" | "chips" | "stack" | "minimal";
type BookingVariant = "default" | "soft" | "solid" | "outline" | "glass";
type BookingPlacement = "username" | "description" | "social";

// Same order and labels as buildSocialLinks() — the owner can't reorder them.
const SOCIAL_ORDER: SocialKey[] = ["website", "instagram", "email", "youtube", "whatsapp"];
const SOCIALS: Record<SocialKey, { Icon: ComponentType<{ className?: string }>; label: string }> = {
  website: { Icon: Globe, label: "Website" },
  instagram: { Icon: InstagramIcon, label: "Instagram" },
  email: { Icon: Mail, label: "Email" },
  youtube: { Icon: YoutubeIcon, label: "YouTube" },
  whatsapp: { Icon: WhatsAppIcon, label: "WhatsApp" },
};

const SURFACE = "border border-(--s-text)/10 bg-(--s-btn) text-(--s-btn-text)";

function SocialRow({ keys, layout, anchor }: { keys: SocialKey[]; layout: SocialLayout; anchor?: string }) {
  const ordered = SOCIAL_ORDER.filter((k) => keys.includes(k));
  if (layout === "stack") {
    return (
      <div data-anchor={anchor} className="mt-4 flex w-full flex-col gap-1.5 px-5">
        {ordered.map((k) => {
          const { Icon, label } = SOCIALS[k];
          return (
            <span key={k} className={`relative flex h-9 items-center justify-center rounded-[9px] text-[11px] font-medium ${SURFACE}`}>
              <Icon className="absolute left-3 h-3.5 w-3.5" />
              {label}
              <ArrowUpRight className="absolute right-3 h-3 w-3 opacity-40" />
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div
      data-anchor={anchor}
      className={`mt-3.5 flex w-fit flex-wrap justify-center ${layout === "minimal" ? "gap-3.5" : "gap-1.5"}`}
    >
      {ordered.map((k) => {
        const { Icon, label } = SOCIALS[k];
        if (layout === "minimal") {
          return <Icon key={k} className="h-4 w-4 text-(--s-muted)" />;
        }
        if (layout === "chips") {
          return (
            <span key={k} className={`flex h-[30px] items-center gap-1.5 rounded-[8px] px-2.5 text-[10.5px] font-medium ${SURFACE}`}>
              <Icon className="h-3 w-3" />
              {label}
            </span>
          );
        }
        return (
          <span key={k} className={`flex h-[30px] w-[30px] items-center justify-center rounded-[8px] ${SURFACE}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        );
      })}
    </div>
  );
}

// bookingButtonPresentation(): untouched default = soft emerald; any other look
// uses the owner's booking color (here `--s-accent`).
const BOOKING_VARIANTS: Record<BookingVariant, string> = {
  default:
    "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  soft: "border border-[color-mix(in_srgb,var(--s-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--s-accent)_14%,transparent)] text-(--s-accent)",
  solid: "border border-transparent bg-(--s-accent) text-white",
  outline: "border-2 border-(--s-accent) text-(--s-accent)",
  glass: "border border-white/20 bg-[color-mix(in_srgb,var(--s-bg)_40%,transparent)] text-(--s-accent) backdrop-blur-md",
};

function BookButton({
  label,
  variant,
  anchor,
  tap,
  className = "mt-3",
}: {
  label: string;
  variant: BookingVariant;
  anchor?: string;
  tap?: number; // TapRing delay, when the finger taps it
  className?: string;
}) {
  return (
    <div className={`flex w-full justify-center ${className}`}>
      <span
        data-anchor={anchor}
        className={`relative inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[11.5px] font-medium transition-[background-color,color,border-color] duration-500 ${BOOKING_VARIANTS[variant]}`}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        {label}
        {tap !== undefined && <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
      </span>
    </div>
  );
}

type Business = {
  name: string;
  handle: string;
  avatar: PhotoId;
  hue: number;
  bio?: string;
  address?: string; // AddressMenu shows the city only
  stats: [string, string];
};

function ProfileTop({
  b,
  mock,
  follow,
  socials,
  socialLayout,
  booking,
  placement = "username",
  tapBook,
}: {
  b: Business;
  mock: Mock;
  follow?: boolean; // Follow shows to signed-in visitors only
  socials: SocialKey[];
  socialLayout: SocialLayout;
  booking: BookingVariant;
  placement?: BookingPlacement;
  tapBook?: number;
}) {
  const book = (className: string) => (
    <BookButton label={mock.bookNow} variant={booking} anchor="book" tap={tapBook} className={className} />
  );
  return (
    <div className="relative flex flex-col items-center pt-[50px] text-center">
      <div data-anchor="profile" className="flex w-fit flex-col items-center">
        <Photo id={b.avatar} hue={b.hue} sizes="66px" className="h-[66px] w-[66px] rounded-full ring-[3px] ring-(--s-bg) shadow-lg" />
        <p className="mt-2.5 text-[15px] leading-tight font-bold tracking-tight">{b.name}</p>
        <p className="text-[10px] text-(--s-muted)">@{b.handle}</p>
      </div>
      {placement === "username" && book("mt-2.5")}
      {b.bio && <p className="mt-2 px-7 text-[10.5px] leading-snug text-(--s-muted)">{b.bio}</p>}
      {placement === "description" && book("mt-2.5")}
      {b.address && (
        <span
          data-anchor="address"
          className={`mt-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] ${SURFACE}`}
        >
          <MapPin className="h-3 w-3" />
          {b.address}
        </span>
      )}
      <div className="mt-3 flex items-center gap-3.5 text-[10px]">
        <span>
          <b className="font-semibold">{b.stats[0]}</b> <span className="text-(--s-muted)">{mock.followers}</span>
        </span>
        <span>
          <b className="font-semibold">{b.stats[1]}</b> <span className="text-(--s-muted)">{mock.following}</span>
        </span>
        {follow && (
          <span
            data-anchor="follow"
            className="inline-flex items-center gap-1 rounded-full bg-(--s-text) px-2.5 py-1 text-[10px] font-semibold text-(--s-bg)"
          >
            <UserPlus className="h-3 w-3" />
            {mock.follow}
          </span>
        )}
      </div>
      <SocialRow keys={socials} layout={socialLayout} anchor="socials" />
      {placement === "social" && book("mt-3.5")}
    </div>
  );
}

function SectionTitle({ title, count, anchor }: { title: string; count: number; anchor?: string }) {
  return (
    <p className="mt-6 mb-2 px-4 text-[12.5px] font-semibold">
      <span data-anchor={anchor} className="inline-block">
        {title}
        <span className="ml-1 text-[10.5px] font-normal text-(--s-muted) tabular-nums">{count}</span>
      </span>
    </p>
  );
}

// Gallery "grid" layout (the default): 3 square columns. `eager` for the first
// slide's photos, which are on screen at load. Tiles reusing a features-section
// file (/home/gallery-*) take its `sizes`, so the browser fetches it once.
function GalleryGrid({ photos, hue, eager }: { photos: PhotoId[]; hue: number; eager?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-1 px-4">
      {photos.map((id, i) => (
        <Photo
          key={id}
          id={id}
          hue={hue + i * 18}
          sizes={PHOTOS[id]?.startsWith("/home/gallery-") ? GALLERY_SIZES : "120px"}
          eager={eager}
          className="aspect-square rounded-md"
        />
      ))}
    </div>
  );
}

// Gallery "masonry" layout: 2 columns, natural aspect ratios.
function GalleryMasonry({ photos, ratios, hue }: { photos: PhotoId[]; ratios: number[]; hue: number }) {
  return (
    <div className="columns-2 gap-1.5 px-4 [&>*]:mb-1.5">
      {photos.map((id, i) => (
        <Photo
          key={id}
          id={id}
          hue={hue + i * 18}
          sizes="140px"
          className="break-inside-avoid rounded-md"
          style={{ aspectRatio: ratios[i] ?? 0.8 }}
        />
      ))}
    </div>
  );
}

// Publications "grid" layout: compact SpaceCards (square preview, title over a gradient).
function PublicationCards({ items }: { items: { id: PhotoId; title: string; hue: number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-4">
      {items.map((p) => (
        <div key={p.id} className="relative overflow-hidden rounded-xl border border-(--s-text)/10">
          <Photo id={p.id} hue={p.hue} sizes="130px" className="aspect-square" />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pt-7 pb-1.5 text-left">
            <span className="block truncate text-[10.5px] font-semibold text-white">{p.title}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// Links "pills" layout: favicon + title chips that wrap.
function LinkPills({ labels }: { labels: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 px-4">
      {labels.map((label) => (
        <span
          key={label}
          className={`inline-flex h-[30px] max-w-full items-center gap-1.5 rounded-full pr-3 pl-1 text-[10.5px] font-medium ${SURFACE}`}
        >
          <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-black/5">
            <Globe className="h-3 w-3 text-neutral-500" />
          </span>
          <span className="truncate">{label}</span>
        </span>
      ))}
    </div>
  );
}

/* ───────────────────────── Shared step timing ───────────────────────── */

// Flips true when the step's tap (a TapRing with delay `tap`, in seconds) lands.
function useTapped(step: number, tap: number) {
  const reduce = useReduceMotion();
  const [tapped, setTapped] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setTapped(step), reduce ? 0 : (tap + TAP_LAND) * 1000);
    return () => clearTimeout(t);
  }, [step, tap, reduce]);
  return tapped === step;
}

/* ───────────────────────── 1 · Hero (Velora) ───────────────────────── */

export function HeroScreen({ scrollY, rootRef, mock }: ScreenProps) {
  return (
    <ScreenRoot scrollY={scrollY} rootRef={rootRef}>
      <ProfileTop
        b={{ name: "Velora Studio", handle: "velorastudio", avatar: "velora-avatar", hue: 40, address: "Milano", stats: ["12.8k", "840"] }}
        mock={mock}
        socials={["website", "instagram", "email", "whatsapp"]}
        socialLayout="icons"
        booking="solid"
      />
      <SectionTitle title={mock.gallery} count={24} />
      <GalleryGrid
        photos={["velora-gallery-1", "velora-gallery-2", "velora-gallery-3", "velora-gallery-4", "velora-gallery-5", "velora-gallery-6"]}
        hue={30}
        eager
      />
    </ScreenRoot>
  );
}

/* ───────────────────────── 2 · Anatomy (barber) ───────────────────────── */

export function AnatomyScreen({ scrollY, rootRef, mock }: ScreenProps) {
  return (
    <ScreenRoot scrollY={scrollY} rootRef={rootRef}>
      <ProfileTop
        b={{
          name: "Northside Barber",
          handle: "northsidebarber",
          avatar: "barber-avatar",
          hue: 220,
          bio: mock.barberBio,
          address: "Milano",
          stats: ["3.2k", "410"],
        }}
        mock={mock}
        socials={["instagram", "email", "whatsapp"]}
        socialLayout="icons"
        booking="default"
      />
      <SectionTitle title={mock.gallery} count={24} anchor="gallery" />
      <GalleryGrid
        photos={["barber-gallery-1", "barber-gallery-2", "barber-gallery-3"]}
        hue={210}
      />
    </ScreenRoot>
  );
}

/* ───────────────────────── 3 · Content (tattoo) ───────────────────────── */

export function ContentScreen({ scrollY, rootRef, mock }: ScreenProps) {
  return (
    <ScreenRoot scrollY={scrollY} rootRef={rootRef}>
      <ProfileTop
        b={{ name: "Ink & Pine", handle: "inkandpine", avatar: "ink-avatar", hue: 150, bio: mock.inkBio, stats: ["5.1k", "260"] }}
        mock={mock}
        follow
        socials={["instagram", "email", "whatsapp"]}
        socialLayout="stack"
        booking="outline"
      />
      <SectionTitle title={mock.publications} count={2} anchor="publications" />
      <PublicationCards
        items={[
          { id: "ink-publication-1", title: mock.inkPublications[0], hue: 150 },
          { id: "ink-publication-2", title: mock.inkPublications[1], hue: 190 },
        ]}
      />
      <SectionTitle title={mock.links} count={3} anchor="links" />
      <LinkPills labels={mock.inkLinks} />
    </ScreenRoot>
  );
}

/* ───────────────────────── 4 · Booking page (physio) ───────────────────────── */

// A fixed month (Nov 2026, starts on a Sunday): the 16th is "today" and fully
// booked, so the 17th is the first open day and is auto-selected, like the real
// flow. Weekends are closed.
const YEAR = 2026;
const MONTH = 10;
const TODAY = 16;
const OPEN_DAYS = new Set([17, 18, 19, 20, 23, 24, 25, 26, 27, 30]);
const PICKED_DAY = 17;
const SLOT_TIMES: [number, number][] = [[9, 0], [9, 45], [10, 30], [11, 15], [12, 0], [14, 30]];
const PICKED_SLOT = 2; // 10:30

const SERVICE_META = [
  { minutes: 50, price: 60 },
  { minutes: 45, price: 55 },
  { minutes: 30, price: 35 },
];
const euro = (n: number) => `€${n.toFixed(2)}`;

// Each step's last tap (Continue, a time slot, Confirm) lands just before the
// carousel moves to the next step, so the flow reacts right after the tap.
const BOOKING_STEP_S = SLIDES.find((s) => s.kind === "booking")!.stepMs / 1000;
const ADVANCE_TAP = BOOKING_STEP_S - TAP_LAND - 0.35;

function Option({ on, children, className = "" }: { on: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative rounded-[10px] border transition-[background-color,border-color] duration-300 ${
        on
          ? "border-(--s-accent) bg-[color-mix(in_srgb,var(--s-accent)_9%,var(--s-bg))]"
          : "border-(--s-text)/12 bg-(--s-bg)"
      } ${className}`}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children, tap }: { children: ReactNode; tap?: number }) {
  return (
    <span className="relative flex h-9 items-center justify-center gap-1.5 rounded-[8px] bg-(--s-accent) text-[11.5px] font-semibold text-white">
      {children}
      {tap !== undefined && <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
    </span>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9.5px] text-(--s-muted)">
      <ChevronLeft className="h-3 w-3" />
      {label}
    </span>
  );
}

function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <p className="text-[12px] font-semibold">{title}</p>
      {hint && <p className="mt-0.5 text-[9.5px] leading-snug text-(--s-muted)">{hint}</p>}
    </div>
  );
}

function SummaryRow({ icon, label, value, meta }: { icon: ReactNode; label: string; value: string; meta?: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-[7.5px] font-medium tracking-wide text-(--s-muted) uppercase">{label}</span>
        <span className="block truncate text-[10px] font-medium">{value}</span>
      </span>
      {meta && <span className="shrink-0 text-[9px] text-(--s-muted)">{meta}</span>}
    </div>
  );
}

const ICON_BADGE =
  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--s-accent)_15%,var(--s-bg))] text-(--s-accent)";

export function BookingScreen({ step, scrollY, rootRef, mock, locale }: ScreenProps & { locale: string }) {
  const reduce = useReduceMotion();
  // Step 0 first taps "Book now" on the profile; the booking page then pushes in.
  const [pushIn] = useState(step === 0);
  // Picking a time goes straight on, so on that step the pick is the advancing tap.
  const tap = step === 0 && pushIn ? 1.25 : step === 2 ? ADVANCE_TAP : 0.55;
  const tapped = useTapped(step, tap);

  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
  const firstPad = (new Date(YEAR, MONTH, 1).getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(YEAR, MONTH + 1, 0).getDate();
  const pickedDate = new Date(YEAR, MONTH, PICKED_DAY);
  const slotTime = (i: number) => timeFmt.format(new Date(YEAR, MONTH, PICKED_DAY, ...SLOT_TIMES[i]));

  const services = mock.physioServices.map((name, i) => ({ name, ...SERVICE_META[i] }));
  const svc = services[0];
  const staff = [
    { name: "Giulia", photo: "physio-staff-1" as const, hue: 200 },
    { name: "Marco", photo: "physio-staff-2" as const, hue: 250 },
  ];
  const email = "sara@email.com";

  const panels = [
    // Service: multi-select; the total + Continue appear once one is picked
    <div key="svc" className="space-y-2">
      <Heading title={mock.chooseService} hint={mock.selectServicesHint} />
      {services.map((s, i) => {
        const on = i === 0 && tapped;
        return (
          <Option key={s.name} on={on} className="flex items-center gap-2.5 px-2.5 py-2">
            <span
              className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-300 ${
                on ? "border-(--s-accent) bg-(--s-accent) text-white" : "border-(--s-text)/20"
              }`}
            >
              {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              {i === 0 && <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-medium">{s.name}</span>
                <span className="text-[10px] text-(--s-muted) tabular-nums">{euro(s.price)}</span>
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[9px] text-(--s-muted)">
                <Clock className="h-2.5 w-2.5" />
                {s.minutes} min
              </span>
            </span>
          </Option>
        );
      })}
      <motion.div
        className="space-y-2 pt-1"
        initial={false}
        animate={still({ opacity: tapped ? 1 : 0, transform: tapped ? "translateY(0px)" : "translateY(6px)" }, reduce)}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      >
        <div className="flex items-center justify-between rounded-[10px] border border-(--s-accent)/40 bg-[color-mix(in_srgb,var(--s-accent)_7%,var(--s-bg))] px-3 py-2 text-[10.5px]">
          <span className="font-medium">{mock.total}</span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-(--s-muted)">
              <Clock className="h-2.5 w-2.5" />
              {svc.minutes} min
            </span>
            <span className="font-semibold tabular-nums">{euro(svc.price)}</span>
          </span>
        </div>
        <PrimaryButton tap={ADVANCE_TAP}>
          {mock.continue}
          <ChevronRight className="h-3.5 w-3.5" />
        </PrimaryButton>
      </motion.div>
    </div>,

    // Specialist, per service ("Any available" is the default)
    <div key="staff" className="space-y-2.5">
      <BackLink label={mock.back} />
      <Heading title={mock.chooseSpecialist} hint={mock.specialistHint} />
      <div className="space-y-1.5 rounded-[10px] border border-(--s-text)/12 bg-(--s-surface)/50 p-2">
        <p className="px-0.5 text-[8px] font-semibold tracking-wide text-(--s-muted) uppercase">{svc.name}</p>
        <Option on={!tapped} className="flex items-center gap-2 px-2 py-1.5">
          <span className={ICON_BADGE}>
            <Sparkles className="h-3 w-3" />
          </span>
          <span className="text-[10.5px] font-medium">{mock.anyAvailable}</span>
        </Option>
        {staff.map((p, i) => (
          <Option key={p.name} on={i === 0 && tapped} className="flex items-center gap-2 px-2 py-1.5">
            <Photo id={p.photo} hue={p.hue} sizes="24px" className="h-6 w-6 shrink-0 rounded-full" />
            <span className="text-[10.5px] font-medium">{p.name}</span>
            {i === 0 && <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
          </Option>
        ))}
      </div>
      <PrimaryButton tap={ADVANCE_TAP}>
        {mock.continue}
        <ChevronRight className="h-3.5 w-3.5" />
      </PrimaryButton>
    </div>,

    // Date & time: month calendar + the day's slots; picking a time goes straight on
    <div key="time" className="space-y-2.5">
      <BackLink label={mock.back} />
      <p className="truncate text-[12px] font-semibold">{mock.pickDateTime.replace("{service}", svc.name)}</p>
      <div className="rounded-[12px] border border-(--s-text)/12 p-2">
        <div className="mb-1 flex items-center justify-between px-0.5">
          <ChevronLeft className="h-3 w-3 opacity-30" />
          <span className="text-[10.5px] font-semibold capitalize">{monthFmt.format(new Date(YEAR, MONTH, 1))}</span>
          <ChevronRight className="h-3 w-3 text-(--s-muted)" />
        </div>
        <div className="mb-0.5 grid grid-cols-7 text-center text-[7.5px] font-medium text-(--s-muted)">
          {weekdays.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: firstPad }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1;
            const open = OPEN_DAYS.has(d);
            const picked = d === PICKED_DAY;
            return (
              <span
                key={d}
                className={`relative flex h-[23px] items-center justify-center rounded-[6px] text-[9.5px] tabular-nums ${
                  picked
                    ? "bg-(--s-accent) font-semibold text-white"
                    : open
                      ? "font-medium"
                      : "text-(--s-muted)/50"
                } ${d === TODAY ? "ring-1 ring-(--s-accent)/40 ring-inset" : ""}`}
              >
                {d}
                {open && !picked && <span className="absolute bottom-[2px] h-[3px] w-[3px] rounded-full bg-(--s-accent)" />}
              </span>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[9px] font-medium text-(--s-muted)">{dayFmt.format(pickedDate)}</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SLOT_TIMES.map((_, i) => (
            <Option key={i} on={i === PICKED_SLOT && tapped} className="py-1.5 text-center text-[10px] tabular-nums">
              {slotTime(i)}
              {i === PICKED_SLOT && <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
            </Option>
          ))}
        </div>
      </div>
    </div>,

    // Details: guest sign-in prompt, summary, contact fields, reminder opt-in (unticked until chosen)
    <div key="details" className="space-y-1.5">
      <BackLink label={mock.back} />
      <div className="flex items-center gap-2 rounded-[12px] bg-gradient-to-r from-emerald-500 to-teal-500 px-2.5 py-2 text-white shadow-sm">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Sparkles className="h-3 w-3" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] leading-tight font-bold">{mock.signInTitle}</span>
          <span className="block truncate text-[8px] text-white/90">{mock.signInBody}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[8px] font-semibold text-emerald-700">{mock.signInCta}</span>
      </div>
      <div className="divide-y divide-(--s-text)/10 overflow-hidden rounded-[10px] border border-(--s-text)/12 bg-(--s-surface)/50">
        <SummaryRow
          icon={<span className={ICON_BADGE}><Tag className="h-3 w-3" /></span>}
          label={mock.summaryService}
          value={svc.name}
          meta={`${svc.minutes} min · ${euro(svc.price)}`}
        />
        <SummaryRow
          icon={<span className={ICON_BADGE}><CalendarDays className="h-3 w-3" /></span>}
          label={mock.summaryWhen}
          value={dayFmt.format(pickedDate)}
          meta={slotTime(PICKED_SLOT)}
        />
        <SummaryRow
          icon={<Photo id="physio-staff-1" hue={200} sizes="24px" className="h-6 w-6 shrink-0 rounded-full" />}
          label={mock.summarySpecialist}
          value="Giulia"
        />
      </div>
      <p className="pt-0.5 text-[11px] font-semibold">{mock.yourDetails}</p>
      {[
        [mock.fullName, "Sara Bianchi"],
        [mock.emailOptional, email],
      ].map(([placeholder, value]) => (
        <span
          key={placeholder}
          aria-label={placeholder}
          className="block rounded-[8px] border border-(--s-text)/12 px-2.5 py-1.5 text-[10px]"
        >
          {value}
        </span>
      ))}
      <div className="flex gap-1.5">
        <span className="flex shrink-0 items-center gap-1 rounded-[8px] border border-(--s-text)/12 px-2 text-[10px]">
          🇮🇹 +39
          <ChevronDown className="h-2.5 w-2.5 text-(--s-muted)" />
        </span>
        <span aria-label={mock.phone} className="block flex-1 rounded-[8px] border border-(--s-text)/12 px-2.5 py-1.5 text-[10px]">
          333 123 4567
        </span>
      </div>
      <div className="flex items-start gap-2 text-[9px] leading-snug text-(--s-muted)">
        <span
          className={`relative mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-300 ${
            tapped ? "border-(--s-accent) bg-(--s-accent) text-white" : "border-(--s-text)/25"
          }`}
        >
          {tapped && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
          <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </span>
        {mock.whatsapp}
      </div>
      <PrimaryButton tap={ADVANCE_TAP}>{mock.confirm}</PrimaryButton>
    </div>,

    // Done
    <div key="done" className="flex flex-col items-center pt-8 text-center">
      <motion.span
        className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--s-accent)_15%,var(--s-bg))] text-(--s-accent)"
        initial={still({ opacity: 0, transform: "scale(0.8)" }, reduce)}
        animate={still({ opacity: 1, transform: "scale(1)" }, reduce)}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3, delay: 0.15 }}
      >
        <Check className="h-6 w-6" strokeWidth={2.5} />
      </motion.span>
      <p className="mt-3 text-[14px] font-semibold">{mock.booked}</p>
      <p className="mt-1 text-[11px] font-medium">{mock.withName.replace("{name}", "Giulia")}</p>
      <p className="mt-1.5 px-2 text-[10px] leading-snug text-(--s-muted)">{mock.confirmationSent.replace("{email}", email)}</p>
      <p className="mt-3 text-[10.5px] font-medium text-(--s-accent)">{mock.manageBooking}</p>
    </div>,
  ];

  // /[username]/booking: back + share, the business, then the flow on a card.
  const page = (
    <motion.div
      className="absolute inset-0 z-10 bg-(--s-bg) shadow-[-12px_0_30px_-14px_rgb(0_0_0_/_0.35)]"
      style={{ "--s-accent": EMERALD } as CSSProperties}
      initial={pushIn ? (reduce ? { opacity: 0 } : { transform: "translateX(100%)" }) : false}
      animate={reduce ? { opacity: 1 } : { transform: "translateX(0%)" }}
      transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1], delay: 0.65 }}
    >
      <div
        aria-hidden
        className="absolute top-0 left-1/2 h-36 w-56 -translate-x-1/2 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-600/20"
      />
      <div className="relative flex items-center justify-between px-3 pt-[46px]">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-(--s-text)/12 bg-(--s-bg)">
          <ChevronLeft className="h-3.5 w-3.5" />
        </span>
        <span className="inline-flex h-7 items-center gap-1 rounded-full border border-(--s-text)/12 bg-(--s-bg) px-2.5 text-[9.5px] font-medium">
          <Share2 className="h-3 w-3" />
          {mock.share}
        </span>
      </div>
      <div className="relative -mt-2 flex flex-col items-center">
        <Photo id="physio-avatar" hue={170} sizes="44px" className="h-11 w-11 rounded-full shadow-md ring-2 ring-(--s-bg)" />
        <p className="mt-1.5 text-[14px] font-bold tracking-tight">Forma Physio</p>
      </div>
      <div className="absolute inset-x-3 top-[150px] bottom-3 overflow-hidden rounded-2xl border border-(--s-text)/12 bg-(--s-bg) shadow-sm">
        <AnimatePresence initial={false}>
          <motion.div
            key={step}
            className="absolute inset-0 p-3"
            initial={still({ opacity: 0, transform: "translateX(24px)" }, reduce)}
            animate={still({ opacity: 1, transform: "translateX(0px)" }, reduce)}
            exit={still({ opacity: 0, transform: "translateX(-18px)" }, reduce)}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {panels[step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );

  return (
    <ScreenRoot
      vars={{ "--s-accent": "#0891b2", "--s-cover": "rgb(8 145 178 / 0.18)" }}
      scrollY={scrollY}
      rootRef={rootRef}
      overlay={page}
    >
      <ProfileTop
        b={{ name: "Forma Physio", handle: "formaphysio", avatar: "physio-avatar", hue: 170, bio: mock.physioBio, address: "Bologna", stats: ["1.9k", "214"] }}
        mock={mock}
        socials={["website", "instagram", "whatsapp"]}
        socialLayout="icons"
        booking="solid"
        tapBook={pushIn ? 0.15 : undefined}
      />
    </ScreenRoot>
  );
}

/* ───────────────────────── 5 · Style picker (nails) ───────────────────────── */

const PICKER_ACTIVE = "border-violet-500 bg-violet-500/10 text-(--s-text)";
const PICKER_IDLE = "border-(--s-text)/15 text-(--s-muted)";

function ColorGroup({
  label,
  presets,
  selected,
  tap,
  tapIndex,
  defaultLabel,
}: {
  label: string;
  presets: string[];
  selected: number | null; // preset index, null = default
  tap: number;
  tapIndex: number;
  defaultLabel: string;
}) {
  const swatch =
    "relative flex h-[25px] w-[25px] items-center justify-center rounded-full border transition-[border-color,box-shadow] duration-300";
  const on = "border-violet-500 ring-2 ring-violet-500/40";
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10.5px] font-medium">{label}</p>
        <span className="w-[66px] rounded-[5px] border border-(--s-text)/15 px-1.5 py-0.5 text-right font-mono text-[8.5px] text-(--s-muted)">
          {selected === null ? defaultLabel : presets[selected]}
        </span>
      </div>
      <div className="grid grid-cols-7 justify-items-center gap-y-1.5">
        <span className={`${swatch} ${selected === null ? on : "border-(--s-text)/20"}`}>
          <Ban className="h-3 w-3 text-(--s-muted)" />
        </span>
        {presets.map((c, i) => (
          <span key={c} className={`${swatch} ${i === selected ? on : "border-black/10"}`} style={{ backgroundColor: c }}>
            {i === selected && <Check className="h-3 w-3 text-white mix-blend-difference" />}
            {i === tapIndex && <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
          </span>
        ))}
        <span
          className={`${swatch} border-transparent p-[3px]`}
          style={{ background: "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)" }}
        >
          <span className="block h-full w-full rounded-full bg-(--s-bg)" />
        </span>
      </div>
    </div>
  );
}

const VARIANT_VISUAL = [
  "border border-emerald-500/40 bg-emerald-500/15",
  "bg-emerald-500",
  "border-2 border-emerald-500",
  "border border-white/30 bg-(--s-text)/10",
];

function VariantRow({ label, options, selected, tap }: { label: string; options: string[]; selected: number; tap: number }) {
  return (
    <div>
      <p className="mb-2 text-[10.5px] font-medium">{label}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {options.map((o, i) => (
          <span
            key={o}
            className={`relative flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[9.5px] transition-colors duration-300 ${
              i === selected ? PICKER_ACTIVE : PICKER_IDLE
            }`}
          >
            <span className={`h-2.5 w-7 rounded-full ${VARIANT_VISUAL[i]}`} />
            {o}
            {i === 1 && <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
          </span>
        ))}
      </div>
    </div>
  );
}

const BAR = "bg-current opacity-35";
const LAYOUT_VISUAL = [
  <span key="icons" className="flex gap-1">
    {[0, 1, 2].map((i) => <span key={i} className={`h-3 w-3 rounded-[3px] ${BAR}`} />)}
  </span>,
  <span key="chips" className="flex gap-1">
    {[0, 1].map((i) => (
      <span key={i} className="flex h-3 items-center gap-0.5 rounded-full border border-current/30 px-1">
        <span className={`h-1.5 w-1.5 rounded-full ${BAR}`} />
        <span className={`h-1 w-2.5 rounded-full ${BAR}`} />
      </span>
    ))}
  </span>,
  <span key="stack" className="flex w-11 flex-col gap-0.5">
    {[0, 1, 2].map((i) => (
      <span key={i} className="flex h-2 items-center justify-center rounded-[2px] border border-current/30">
        <span className={`h-0.5 w-4 rounded-full ${BAR}`} />
      </span>
    ))}
  </span>,
  <span key="minimal" className="flex gap-1.5">
    {[0, 1, 2].map((i) => <span key={i} className={`h-2 w-2 rounded-full ${BAR}`} />)}
  </span>,
];

function LayoutGrid({ label, options, hints, selected, tap }: { label: string; options: string[]; hints: string[]; selected: number; tap: number }) {
  return (
    <div>
      <p className="mb-2 text-[10.5px] font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {options.map((o, i) => (
          <span
            key={o}
            className={`relative flex flex-col items-center gap-1 rounded-xl border px-1.5 pt-1.5 pb-1 transition-colors duration-300 ${
              i === selected ? PICKER_ACTIVE : PICKER_IDLE
            }`}
          >
            <span className="flex h-4 items-center justify-center">{LAYOUT_VISUAL[i]}</span>
            <span className="text-center leading-tight">
              <span className="block text-[9.5px] font-medium">{o}</span>
              <span className="block text-[8px] opacity-70">{hints[i]}</span>
            </span>
            {i === 1 && <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StyleScreen({ step, scrollY, rootRef, mock }: ScreenProps) {
  const reduce = useReduceMotion();
  const tap = step === 0 ? 1.15 : 0.55; // step 0 waits for the sheet to land
  const tapped = useTapped(step, tap);
  const level = step + (tapped ? 1 : 0); // how many of the 4 changes are applied
  // The booking color was already set to the "Pink" preset; this tour changes its look.
  const vars: ScreenVars = {
    "--s-accent": "#db2777",
    ...(level >= 1 ? BLUSH : {}),
    ...(level >= 2 ? { "--s-btn": BTN_PRESETS[ROSE_BTN], "--s-btn-text": "#ffffff" } : {}),
  };
  const tabs = [mock.tabPage, mock.tabButtons, mock.tabBooking];
  const activeTab = [0, 1, 2, 1][step];

  const panels = [
    <ColorGroup
      key="bg"
      label={mock.background}
      presets={BG_PRESETS}
      selected={level >= 1 ? PINK_BG : null}
      tap={tap}
      tapIndex={PINK_BG}
      defaultLabel={mock.defaultColor}
    />,
    <ColorGroup
      key="btn"
      label={mock.buttonColor}
      presets={BTN_PRESETS}
      selected={level >= 2 ? ROSE_BTN : null}
      tap={tap}
      tapIndex={ROSE_BTN}
      defaultLabel={mock.defaultColor}
    />,
    <VariantRow key="booking" label={mock.variantLabel} options={mock.variants} selected={level >= 3 ? 1 : 0} tap={tap} />,
    <LayoutGrid
      key="layout"
      label={mock.layoutLabel}
      options={mock.layouts}
      hints={mock.layoutHints}
      selected={level >= 4 ? 1 : 0}
      tap={tap}
    />,
  ];

  // Phones get the picker as a bottom sheet with a clear backdrop, so the page
  // behind previews every change live.
  const sheet = (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-10 rounded-t-[22px] border-t border-(--s-text)/10 bg-(--s-bg)/95 pb-4 shadow-[0_-10px_30px_-12px_rgb(0_0_0_/_0.3)] backdrop-blur-md"
      initial={reduce ? { opacity: 0 } : { transform: "translateY(100%)" }}
      animate={reduce ? { opacity: 1 } : { transform: "translateY(0%)" }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1], delay: 0.25 }}
    >
      <span className="mx-auto mt-2 mb-1 block h-1 w-9 rounded-full bg-(--s-muted)/30" />
      <div className="flex items-center justify-between px-4 pt-1 pb-2">
        <p className="text-[12.5px] font-semibold">{mock.style}</p>
        <span className="flex items-center gap-2 text-(--s-muted)">
          <span className="inline-flex items-center gap-1 text-[9.5px] font-medium">
            <RotateCcw className="h-2.5 w-2.5" />
            {mock.reset}
          </span>
          <X className="h-3 w-3" />
        </span>
      </div>
      <div className="px-4 pb-2.5">
        <div className="flex rounded-lg bg-(--s-surface) p-0.5">
          {tabs.map((tab, i) => (
            <span
              key={tab}
              className={`flex-1 rounded-md py-1 text-center text-[10px] font-medium transition-[background-color,color,box-shadow] duration-300 ${
                i === activeTab ? "bg-(--s-bg) text-(--s-text) shadow-sm" : "text-(--s-muted)"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
      </div>
      <div className="relative h-[118px] border-t border-(--s-text)/10">
        <AnimatePresence>
          <motion.div
            key={step}
            className="absolute inset-0 px-4 pt-3"
            initial={still({ opacity: 0, transform: "translateY(6px)" }, reduce)}
            animate={still({ opacity: 1, transform: "translateY(0px)" }, reduce)}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
          >
            {panels[step]}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );

  return (
    <ScreenRoot vars={vars} scrollY={scrollY} rootRef={rootRef} overlay={sheet}>
      <ProfileTop
        b={{ name: "Bloom Nails", handle: "bloomnails", avatar: "bloom-avatar", hue: 350, bio: mock.bloomBio, address: "Torino", stats: ["2.4k", "318"] }}
        mock={mock}
        socials={["instagram", "email", "whatsapp"]}
        socialLayout={level >= 4 ? "chips" : "icons"}
        booking={level >= 3 ? "solid" : "soft"}
      />
      <SectionTitle title={mock.gallery} count={36} />
      <GalleryGrid photos={["bloom-gallery-1", "bloom-gallery-2", "bloom-gallery-3"]} hue={340} />
    </ScreenRoot>
  );
}

/* ───────────────────────── 6 · Links first (yoga) ───────────────────────── */

export function LinksScreen({ scrollY, rootRef, mock }: ScreenProps) {
  return (
    <ScreenRoot vars={SAGE} scrollY={scrollY} rootRef={rootRef}>
      <ProfileTop
        b={{ name: "Sole Yoga", handle: "soleyoga", avatar: "yoga-avatar", hue: 120, bio: mock.yogaBio, stats: ["1.1k", "190"] }}
        mock={mock}
        socials={["instagram", "email", "youtube", "whatsapp"]}
        socialLayout="stack"
        booking="solid"
        placement="social"
      />
      <SectionTitle title={mock.links} count={3} />
      <LinkPills labels={mock.yogaLinks} />
    </ScreenRoot>
  );
}

/* ───────────────────────── 7 · Gallery first (photographer) ───────────────────────── */

export function GalleryScreen({ scrollY, rootRef, mock }: ScreenProps) {
  return (
    <ScreenRoot vars={NOIR} scrollY={scrollY} rootRef={rootRef}>
      <ProfileTop
        b={{ name: "Atelier Rosa", handle: "atelierrosa", avatar: "rosa-avatar", hue: 20, bio: mock.rosaBio, stats: ["9.7k", "502"] }}
        mock={mock}
        socials={["website", "instagram", "email"]}
        socialLayout="minimal"
        booking="glass"
      />
      <SectionTitle title={mock.gallery} count={48} />
      <GalleryMasonry
        photos={["rosa-gallery-1", "rosa-gallery-2", "rosa-gallery-3"]}
        ratios={[0.8, 1.25, 4 / 3]}
        hue={15}
      />
    </ScreenRoot>
  );
}
