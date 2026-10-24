"use client";

import { useEffect, useState, type ComponentType, type CSSProperties, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
} from "lucide-react";
import { InstagramIcon, YoutubeIcon } from "@/features/profile/components/BrandIcons";
import type { ShowcaseCopy } from "./content";
import { Photo, type PhotoId } from "./Photo";
import { EASE_OUT, StatusBar, TapRing } from "./phone";

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

// Pages with an owner-picked background lock their own palette, like the real
// profile does; the rest follow the site theme through `.showcase-screen` vars.
const SAGE: ScreenVars = {
  "--s-bg": "#e8eee4",
  "--s-surface": "#dce5d6",
  "--s-text": "#22301f",
  "--s-muted": "rgb(34 48 31 / 0.62)",
  "--s-btn": "#ffffff",
  "--s-btn-text": "#22301f",
  "--s-accent": "#3f6b4a",
  "--s-cover": "rgb(63 107 74 / 0.2)",
};
const NOIR: ScreenVars = {
  "--s-bg": "#121014",
  "--s-surface": "#1d1a20",
  "--s-text": "#f3eee9",
  "--s-muted": "rgb(243 238 233 / 0.6)",
  "--s-btn": "rgb(255 255 255 / 0.08)",
  "--s-btn-text": "#f3eee9",
  "--s-accent": "#d9a38b",
  "--s-cover": "rgb(217 163 139 / 0.24)",
};
const BLUSH: ScreenVars = {
  "--s-bg": "#f7e4e8",
  "--s-surface": "#f0d3da",
  "--s-text": "#3b1f2b",
  "--s-muted": "rgb(59 31 43 / 0.62)",
  "--s-accent": "#b4466a",
  "--s-cover": "rgb(180 70 106 / 0.18)",
};

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
    <div
      className="absolute inset-0 bg-(--s-bg) text-(--s-text) transition-[background-color,color] duration-500"
      style={vars as CSSProperties}
    >
      <StatusBar />
      <div
        ref={rootRef}
        className="showcase-scroll relative pb-10"
        style={{ transform: `translateY(${-scrollY}px)` }}
      >
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[130px] bg-[linear-gradient(180deg,var(--s-cover),transparent)] transition-[background-image] duration-500"
        />
        {children}
      </div>
      {overlay}
    </div>
  );
}

type SocialKey = "web" | "instagram" | "whatsapp" | "youtube" | "email";
type SocialLayout = "icons" | "chips" | "stack" | "minimal";
type BookingVariant = "soft" | "solid" | "outline" | "glass";

const SOCIALS: Record<SocialKey, { Icon: ComponentType<{ className?: string }>; label: string }> = {
  web: { Icon: Globe, label: "Web" },
  instagram: { Icon: InstagramIcon, label: "Instagram" },
  whatsapp: { Icon: MessageCircle, label: "WhatsApp" },
  youtube: { Icon: YoutubeIcon, label: "YouTube" },
  email: { Icon: Mail, label: "Email" },
};

function SocialRow({ keys, layout, anchor }: { keys: SocialKey[]; layout: SocialLayout; anchor?: string }) {
  const surface = "bg-(--s-btn) text-(--s-btn-text) transition-[background-color,color] duration-500";
  if (layout === "stack") {
    return (
      <div data-anchor={anchor} className="mt-3.5 w-full space-y-1.5 px-5">
        {keys.map((k) => {
          const { Icon, label } = SOCIALS[k];
          return (
            <span key={k} className={`flex h-9 items-center gap-2.5 rounded-xl px-3 text-[11px] font-semibold ${surface}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
              <ChevronRight className="ml-auto h-3 w-3 opacity-50" />
            </span>
          );
        })}
      </div>
    );
  }
  return (
    <div data-anchor={anchor} className="mt-3 flex w-fit flex-wrap justify-center gap-1.5">
      {keys.map((k) => {
        const { Icon, label } = SOCIALS[k];
        if (layout === "chips") {
          return (
            <span key={k} className={`flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold ${surface}`}>
              <Icon className="h-3 w-3" />
              {label}
            </span>
          );
        }
        return (
          <span
            key={k}
            className={`flex h-[30px] w-[30px] items-center justify-center rounded-full ${
              layout === "minimal" ? "text-(--s-text)" : surface
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        );
      })}
    </div>
  );
}

const BOOKING_VARIANTS: Record<BookingVariant, string> = {
  soft: "bg-[color-mix(in_oklab,var(--s-accent)_16%,transparent)] text-(--s-accent)",
  solid: "bg-(--s-accent) text-white shadow-[0_8px_18px_-8px_var(--s-accent)]",
  outline: "border-[1.5px] border-(--s-accent) text-(--s-accent)",
  glass: "border border-white/20 bg-white/10 text-(--s-text) backdrop-blur-md",
};

function BookButton({ label, variant, anchor }: { label: string; variant: BookingVariant; anchor?: string }) {
  return (
    <div className="mt-3.5 w-full px-5">
      <span
        data-anchor={anchor}
        className={`flex h-10 w-full items-center justify-center gap-2 rounded-full text-[12px] font-semibold transition-[background-color,color,border-color,box-shadow] duration-500 ${BOOKING_VARIANTS[variant]}`}
      >
        <CalendarDays className="h-3.5 w-3.5" />
        {label}
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
  address?: string;
  stats?: [string, string];
};

function ProfileTop({
  b,
  mock,
  follow,
  socials,
  socialLayout,
  booking,
}: {
  b: Business;
  mock: Mock;
  follow?: boolean;
  socials: SocialKey[];
  socialLayout: SocialLayout;
  booking: BookingVariant;
}) {
  return (
    <div className="relative flex flex-col items-center pt-[50px] text-center">
      <div data-anchor="profile" className="flex w-fit flex-col items-center">
        <Photo id={b.avatar} hue={b.hue} className="h-[66px] w-[66px] rounded-full ring-[3px] ring-(--s-bg) shadow-lg" />
        <p className="mt-2 text-[15px] leading-tight font-bold tracking-tight">{b.name}</p>
        <p className="text-[10px] text-(--s-muted)">@{b.handle}</p>
      </div>
      {b.bio && <p className="mt-1.5 px-7 text-[10.5px] leading-snug text-(--s-muted)">{b.bio}</p>}
      {b.address && (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-(--s-btn) px-2.5 py-1 text-[9.5px] font-medium text-(--s-btn-text)">
          <MapPin className="h-2.5 w-2.5" />
          {b.address}
        </span>
      )}
      {(b.stats || follow) && (
        <div className="mt-2.5 flex items-center gap-3.5 text-[10px]">
          {b.stats && (
            <>
              <span>
                <b className="font-semibold">{b.stats[0]}</b> <span className="text-(--s-muted)">{mock.followers}</span>
              </span>
              <span>
                <b className="font-semibold">{b.stats[1]}</b> <span className="text-(--s-muted)">{mock.following}</span>
              </span>
            </>
          )}
          {follow && (
            <span
              data-anchor="follow"
              className="rounded-full bg-(--s-text) px-3 py-1 text-[10px] font-semibold text-(--s-bg)"
            >
              {mock.follow}
            </span>
          )}
        </div>
      )}
      <SocialRow keys={socials} layout={socialLayout} anchor="socials" />
      <BookButton label={mock.bookNow} variant={booking} anchor="book" />
    </div>
  );
}

function SectionTitle({ title, count, anchor }: { title: string; count?: number; anchor?: string }) {
  return (
    <p className="mt-5 mb-2 px-5 text-[12px] font-semibold">
      <span data-anchor={anchor} className="inline-block">
        {title}
        {count !== undefined && <span className="ml-1 font-normal text-(--s-muted)">{count}</span>}
      </span>
    </p>
  );
}

type Service = { name: string; minutes: number; price: number; photo?: PhotoId };

const euro = (n: number) => `€${n.toFixed(2)}`;

function ServiceList({ services, hue }: { services: Service[]; hue: number }) {
  return (
    <div className="space-y-1.5 px-4">
      {services.map((s, i) => (
        <div key={s.name} className="flex items-center gap-2.5 rounded-2xl bg-(--s-surface) p-2 pr-2.5">
          {s.photo && <Photo id={s.photo} hue={hue + i * 24} className="h-9 w-9 shrink-0 rounded-xl" />}
          <span className={`min-w-0 flex-1 ${s.photo ? "" : "pl-1"}`}>
            <span className="block truncate text-[11.5px] font-semibold">{s.name}</span>
            <span className="flex items-center gap-1 text-[9.5px] text-(--s-muted)">
              <Clock className="h-2.5 w-2.5" />
              {s.minutes} min
            </span>
          </span>
          <span className="text-[11px] font-semibold tabular-nums">{euro(s.price)}</span>
          <ChevronRight className="h-3 w-3 text-(--s-muted)" />
        </div>
      ))}
    </div>
  );
}

function GalleryGrid({ photos, hue, cols = 3 }: { photos: PhotoId[]; hue: number; cols?: 2 | 3 }) {
  return (
    <div className={`grid gap-1 px-4 ${cols === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
      {photos.map((id, i) => (
        <Photo
          key={id}
          id={id}
          hue={hue + i * 18}
          sizes="120px"
          className={`rounded-lg ${cols === 2 ? "aspect-[4/5]" : "aspect-square"}`}
        />
      ))}
    </div>
  );
}

/* ───────────────────────── Shared step timing ───────────────────────── */

// Flips true a beat after a step starts: the moment the "finger" taps.
function useTapped(step: number, delay = 650) {
  const reduce = useReducedMotion();
  const [tapped, setTapped] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setTapped(step), reduce ? 0 : delay);
    return () => clearTimeout(t);
  }, [step, delay, reduce]);
  return tapped === step;
}

/* ───────────────────────── 1 · Hero (Velora) ───────────────────────── */

export function HeroScreen({
  scrollY,
  rootRef,
  mock,
  services,
}: ScreenProps & { services: { name: string; minutes: number; price: number }[] }) {
  const photos: PhotoId[] = ["velora-service-1", "velora-service-2", "velora-service-3"];
  return (
    <ScreenRoot scrollY={scrollY} rootRef={rootRef}>
      <ProfileTop
        b={{ name: "Velora Studio", handle: "velorastudio", avatar: "velora-avatar", hue: 40, stats: ["12.8k", "8.4k"] }}
        mock={mock}
        socials={["web", "instagram", "email", "whatsapp"]}
        socialLayout="icons"
        booking="solid"
      />
      <SectionTitle title={mock.chooseService} />
      <ServiceList services={services.map((s, i) => ({ ...s, photo: photos[i] }))} hue={30} />
      <SectionTitle title={mock.gallery} count={10} />
      <GalleryGrid photos={["velora-gallery-1", "velora-gallery-2", "velora-gallery-3"]} hue={30} />
    </ScreenRoot>
  );
}

/* ───────────────────────── 2 · Anatomy (barber) ───────────────────────── */

export function AnatomyScreen({ scrollY, rootRef, mock }: ScreenProps) {
  const meta = [
    { minutes: 30, price: 22 },
    { minutes: 20, price: 15 },
    { minutes: 45, price: 32 },
  ];
  return (
    <ScreenRoot scrollY={scrollY} rootRef={rootRef}>
      <ProfileTop
        b={{
          name: "Northside Barber",
          handle: "northsidebarber",
          avatar: "barber-avatar",
          hue: 220,
          bio: mock.barberBio,
          address: "Via Tortona 12, Milano",
          stats: ["3.2k", "410"],
        }}
        mock={mock}
        socials={["instagram", "whatsapp", "email"]}
        socialLayout="icons"
        booking="soft"
      />
      <SectionTitle title={mock.services} anchor="services" />
      <ServiceList services={mock.barberServices.map((name, i) => ({ name, ...meta[i] }))} hue={220} />
      <SectionTitle title={mock.gallery} count={24} anchor="gallery" />
      <GalleryGrid
        photos={["barber-gallery-1", "barber-gallery-2", "barber-gallery-3", "barber-gallery-4", "barber-gallery-5", "barber-gallery-6"]}
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
        socials={["instagram", "whatsapp", "email"]}
        socialLayout="chips"
        booking="outline"
      />
      <SectionTitle title={mock.publications} count={2} anchor="publications" />
      <div className="grid grid-cols-2 gap-2 px-4">
        {(["ink-publication-1", "ink-publication-2"] as const).map((id, i) => (
          <div key={id} className="rounded-2xl bg-(--s-surface) p-1.5">
            <Photo id={id} hue={150 + i * 40} className="aspect-[4/3] rounded-xl" />
            <p className="mt-1.5 flex items-center gap-1 px-1 pb-0.5 text-[10px] font-semibold">
              <FileText className="h-3 w-3 shrink-0 text-(--s-muted)" />
              <span className="truncate">{mock.inkPublications[i]}</span>
            </p>
          </div>
        ))}
      </div>
      <SectionTitle title={mock.links} count={3} anchor="links" />
      <div className="flex flex-wrap gap-1.5 px-4">
        {mock.inkLinks.map((label) => (
          <span
            key={label}
            className="flex items-center gap-1.5 rounded-full bg-(--s-btn) py-1.5 pr-3 pl-1.5 text-[10px] font-medium text-(--s-btn-text)"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-(--s-surface)">
              <Globe className="h-2.5 w-2.5" />
            </span>
            {label}
          </span>
        ))}
      </div>
    </ScreenRoot>
  );
}

/* ───────────────────────── 4 · Booking funnel (physio) ───────────────────────── */

const SLOTS = ["9:00", "9:45", "10:30", "11:15", "12:00", "14:30", "15:15", "16:00", "17:30"];
const DAYS = [16, 17, 18, 19, 20, 21, 22]; // Mon → Sun of a fixed week; only the weekday labels matter

function Selectable({ on, children, className = "" }: { on: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={`relative transition-[background-color,box-shadow,color] duration-300 ${
        on ? "bg-[color-mix(in_oklab,var(--s-accent)_14%,var(--s-surface))] shadow-[inset_0_0_0_1.5px_var(--s-accent)]" : "bg-(--s-surface)"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function BookingScreen({ step, scrollY, rootRef, mock, locale }: ScreenProps & { locale: string }) {
  const tap = step === 0 ? 1.15 : 0.55; // step 0 waits for the sheet to land
  const tapped = useTapped(step, tap * 1000 + 100);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const services = mock.physioServices.map((name, i) => ({ name, ...[{ minutes: 50, price: 60 }, { minutes: 45, price: 55 }, { minutes: 30, price: 35 }][i] }));
  const staff = [
    { name: mock.anyAvailable, photo: null },
    { name: "Giulia", photo: "physio-staff-1" as const },
    { name: "Marco", photo: "physio-staff-2" as const },
  ];
  const titles = [mock.chooseService, mock.chooseProfessional, mock.pickTime, mock.yourDetails, ""];

  const panels = [
    // Service
    <div key="svc" className="space-y-1.5">
      {services.map((s, i) => (
        <Selectable key={s.name} on={i === 0 && tapped} className="flex items-center gap-2.5 rounded-2xl p-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-semibold">{s.name}</span>
            <span className="flex items-center gap-1 text-[9.5px] text-(--s-muted)">
              <Clock className="h-2.5 w-2.5" />
              {s.minutes} min
            </span>
          </span>
          <span className="text-[11px] font-semibold tabular-nums">{euro(s.price)}</span>
          <span
            className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors duration-300 ${
              i === 0 && tapped ? "border-(--s-accent) bg-(--s-accent) text-white" : "border-(--s-muted)/40"
            }`}
          >
            {i === 0 && tapped && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
          </span>
          {i === 0 && <TapRing delay={tap} className="top-1/2 right-0.5 -translate-y-1/2" />}
        </Selectable>
      ))}
    </div>,
    // Professional
    <div key="staff" className="grid grid-cols-3 gap-1.5">
      {staff.map((p, i) => (
        <Selectable key={p.name} on={i === 1 && tapped} className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3">
          {p.photo ? (
            <Photo id={p.photo} hue={180 + i * 50} className="h-10 w-10 rounded-full" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--s-bg) text-[13px]">✦</span>
          )}
          <span className="text-center text-[9.5px] leading-tight font-semibold">{p.name}</span>
          {i === 1 && <TapRing className="top-3 left-1/2 -translate-x-1/2" />}
        </Selectable>
      ))}
    </div>,
    // Date & time
    <div key="time">
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d, i) => (
          <span
            key={d}
            className={`flex flex-col items-center rounded-xl py-1.5 ${i === 1 ? "bg-(--s-accent) text-white" : "bg-(--s-surface)"} ${
              i > 4 ? "opacity-40" : ""
            }`}
          >
            <span className="text-[8px] uppercase opacity-70">{weekday.format(new Date(2026, 10, d))}</span>
            <span className="text-[11px] font-semibold tabular-nums">{d}</span>
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {SLOTS.map((s) => (
          <Selectable key={s} on={s === "10:30" && tapped} className="rounded-xl py-2 text-center text-[11px] font-medium tabular-nums">
            {s}
            {s === "10:30" && <TapRing className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
          </Selectable>
        ))}
      </div>
    </div>,
    // Details
    <div key="details" className="space-y-2">
      {[
        [mock.fullName, "Sara Bianchi"],
        [mock.email, "sara@email.com"],
      ].map(([label, value]) => (
        <div key={label} className="rounded-xl bg-(--s-surface) px-3 py-2">
          <span className="block text-[8.5px] text-(--s-muted)">{label}</span>
          <span className="block text-[11px] font-medium">{value}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 px-1 pt-1 text-[10.5px] font-medium">
        <span className="flex h-4 w-4 items-center justify-center rounded-[5px] bg-(--s-accent) text-white">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
        {mock.whatsapp}
      </div>
    </div>,
    // Confirmed
    <div key="done" className="flex flex-col items-center pt-3 text-center">
      <motion.span
        className="flex h-14 w-14 items-center justify-center rounded-full bg-(--s-accent) text-white shadow-[0_10px_24px_-10px_var(--s-accent)]"
        initial={{ opacity: 0, transform: "scale(0.8)" }}
        animate={{ opacity: 1, transform: "scale(1)" }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3, delay: 0.15 }}
      >
        <Check className="h-7 w-7" strokeWidth={2.5} />
      </motion.span>
      <p className="mt-3 text-[14px] font-bold">{mock.confirmed}</p>
      <p className="mt-1 text-[10.5px] text-(--s-muted)">{mock.confirmedBody}</p>
      <div className="mt-4 w-full space-y-1.5 rounded-2xl bg-(--s-surface) p-3 text-left text-[10.5px]">
        <p className="font-semibold">{services[0].name}</p>
        <p className="text-(--s-muted)">Giulia · {weekday.format(new Date(2026, 10, 17))} 17 · 10:30</p>
      </div>
    </div>,
  ];

  const sheet = (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-10 flex h-[76%] flex-col rounded-t-[26px] bg-(--s-bg) px-4 pt-2 shadow-[0_-12px_30px_-12px_rgb(0_0_0_/_0.35)]"
      initial={{ transform: "translateY(100%)" }}
      animate={{ transform: "translateY(0%)" }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1], delay: 0.25 }}
    >
      <span className="mx-auto h-1 w-9 rounded-full bg-(--s-muted)/30" />
      <div className="mt-3 flex h-6 items-center gap-2">
        <ChevronLeft className={`h-4 w-4 transition-opacity duration-300 ${step > 0 && step < 4 ? "opacity-70" : "opacity-0"}`} />
        <p className="flex-1 truncate text-[13px] font-bold">{titles[step]}</p>
        <span className="flex gap-1">
          {titles.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                i === step ? "w-4 bg-(--s-accent)" : i < step ? "w-1.5 bg-(--s-accent)/50" : "w-1.5 bg-(--s-muted)/25"
              }`}
            />
          ))}
        </span>
      </div>
      <div className="relative mt-3 flex-1">
        <AnimatePresence>
          <motion.div
            key={step}
            className="absolute inset-0"
            initial={{ opacity: 0, transform: "translateX(28px)" }}
            animate={{ opacity: 1, transform: "translateX(0px)" }}
            exit={{ opacity: 0, transform: "translateX(-20px)" }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {panels[step]}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={`relative pb-5 transition-opacity duration-300 ${step === 4 ? "opacity-0" : ""}`}>
        <span className="flex h-10 items-center justify-center rounded-full bg-(--s-accent) text-[12px] font-semibold text-white">
          {step === 3 ? mock.confirm : mock.continue}
        </span>
        {step < 4 && <TapRing key={step} delay={tap + 0.9} className="top-0.5 left-1/2 -translate-x-1/2" />}
      </div>
    </motion.div>
  );

  return (
    <ScreenRoot
      vars={{ "--s-accent": "#0f8a7e", "--s-cover": "rgb(15 138 126 / 0.2)" }}
      scrollY={scrollY}
      rootRef={rootRef}
      overlay={
        <>
          <div className="absolute inset-0 z-[5] bg-black/35" aria-hidden />
          {sheet}
        </>
      }
    >
      <ProfileTop
        b={{ name: "Forma Physio", handle: "formaphysio", avatar: "physio-avatar", hue: 170, bio: mock.physioBio }}
        mock={mock}
        socials={["web", "instagram", "whatsapp"]}
        socialLayout="icons"
        booking="solid"
      />
    </ScreenRoot>
  );
}

/* ───────────────────────── 5 · Style picker (nails) ───────────────────────── */

const BG_SWATCHES = ["default", "#ffffff", "#f7e4e8", "#fdf1dc", "#e3f0e6", "#1d1a26", "#2a1f3d"];
const BTN_SWATCHES = ["default", "#e3a5b4", "#c9b8f0", "#a8d5c2", "#f2c58a", "#1d1a26"];

function Swatches({ colors, selected, tapIndex, tap }: { colors: string[]; selected: number; tapIndex: number; tap: number }) {
  return (
    <div className="mt-2 flex gap-2">
      {colors.map((c, i) => (
        <span
          key={c}
          className={`relative h-7 w-7 rounded-full ring-offset-2 ring-offset-(--s-bg) transition-shadow duration-300 ${
            i === selected ? "ring-2 ring-(--s-text)" : "ring-1 ring-black/10"
          }`}
          style={{
            background: c === "default" ? "linear-gradient(135deg, #ffffff 50%, #16141c 50%)" : c,
          }}
        >
          {i === tapIndex && <TapRing delay={tap} className="-top-1 -left-1" />}
        </span>
      ))}
    </div>
  );
}

function Segmented({ options, selected, tapIndex, tap }: { options: string[]; selected: number; tapIndex: number; tap: number }) {
  return (
    <div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-(--s-surface) p-1">
      {options.map((o, i) => (
        <span
          key={o}
          className={`relative rounded-lg py-1.5 text-center text-[10px] font-semibold transition-[background-color,box-shadow] duration-300 ${
            i === selected ? "bg-(--s-bg) shadow-sm" : "text-(--s-muted)"
          }`}
        >
          {o}
          {i === tapIndex && <TapRing delay={tap} className="top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
        </span>
      ))}
    </div>
  );
}

export function StyleScreen({ step, scrollY, rootRef, mock }: ScreenProps) {
  const tap = step === 0 ? 1.15 : 0.55; // step 0 waits for the sheet to land
  const tapped = useTapped(step, tap * 1000 + 100);
  const level = step + (tapped ? 1 : 0); // how many of the 4 changes are applied
  const vars: ScreenVars = {
    ...(level >= 1 ? BLUSH : { "--s-accent": "#b4466a", "--s-cover": "rgb(180 70 106 / 0.16)" }),
    ...(level >= 2 ? { "--s-btn": "#e3a5b4", "--s-btn-text": "#3b1f2b" } : {}),
  };
  const tabs = [mock.tabPage, mock.tabButtons, mock.tabBooking];
  const activeTab = [0, 1, 2, 1][step];

  const panels = [
    <div key="bg">
      <p className="text-[10px] font-semibold text-(--s-muted)">{mock.background}</p>
      <Swatches colors={BG_SWATCHES} selected={level >= 1 ? 2 : 0} tapIndex={2} tap={tap} />
    </div>,
    <div key="btn">
      <p className="text-[10px] font-semibold text-(--s-muted)">{mock.buttonColor}</p>
      <Swatches colors={BTN_SWATCHES} selected={level >= 2 ? 1 : 0} tapIndex={1} tap={tap} />
    </div>,
    <div key="booking">
      <p className="text-[10px] font-semibold text-(--s-muted)">{mock.bookNow}</p>
      <Segmented options={mock.variants} selected={level >= 3 ? 1 : 0} tapIndex={1} tap={tap} />
    </div>,
    <div key="layout">
      <p className="text-[10px] font-semibold text-(--s-muted)">{mock.socialLinks}</p>
      <Segmented options={mock.layouts} selected={level >= 4 ? 1 : 0} tapIndex={1} tap={tap} />
    </div>,
  ];

  const sheet = (
    <motion.div
      className="absolute inset-x-0 bottom-0 z-10 rounded-t-[24px] bg-(--s-bg) px-4 pt-2 pb-6 shadow-[0_-10px_30px_-12px_rgb(0_0_0_/_0.3)] transition-[background-color] duration-500"
      initial={{ transform: "translateY(100%)" }}
      animate={{ transform: "translateY(0%)" }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1], delay: 0.25 }}
    >
      <span className="mx-auto block h-1 w-9 rounded-full bg-(--s-muted)/30" />
      <p className="mt-2.5 text-[13px] font-bold">{mock.style}</p>
      <div className="mt-2 flex gap-1 border-b border-(--s-muted)/15">
        {tabs.map((tab, i) => (
          <span
            key={tab}
            className={`-mb-px border-b-2 px-2 pb-1.5 text-[10.5px] font-semibold transition-colors duration-300 ${
              i === activeTab ? "border-(--s-text) text-(--s-text)" : "border-transparent text-(--s-muted)"
            }`}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="relative mt-3 h-[52px]">
        <AnimatePresence>
          <motion.div
            key={step}
            className="absolute inset-0"
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
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
        b={{ name: "Bloom Nails", handle: "bloomnails", avatar: "bloom-avatar", hue: 350, bio: mock.bloomBio, stats: ["2.4k", "318"] }}
        mock={mock}
        socials={["instagram", "whatsapp", "email"]}
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
        b={{ name: "Sole Yoga", handle: "soleyoga", avatar: "yoga-avatar", hue: 120, bio: mock.yogaBio }}
        mock={mock}
        socials={["instagram", "whatsapp", "youtube", "email"]}
        socialLayout="stack"
        booking="solid"
      />
      <SectionTitle title={mock.links} count={3} />
      <div className="flex flex-wrap gap-1.5 px-4">
        {mock.yogaLinks.map((label) => (
          <span key={label} className="flex items-center gap-1.5 rounded-full bg-(--s-btn) py-1.5 pr-3 pl-1.5 text-[10px] font-medium">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-(--s-surface)">
              <Globe className="h-2.5 w-2.5" />
            </span>
            {label}
          </span>
        ))}
      </div>
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
        socials={["web", "instagram", "email"]}
        socialLayout="minimal"
        booking="glass"
      />
      <SectionTitle title={mock.gallery} count={48} />
      <GalleryGrid
        photos={["rosa-gallery-1", "rosa-gallery-2", "rosa-gallery-3", "rosa-gallery-4", "rosa-gallery-5", "rosa-gallery-6"]}
        hue={15}
        cols={2}
      />
    </ScreenRoot>
  );
}
