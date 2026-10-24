"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AudienceSection, GALLERY_SIZES, HeroShowcase, HowSection } from "@/features/home";

const SERVICE_META = [
  { minutes: 45, price: 30 },
  { minutes: 90, price: 45 },
  { minutes: 30, price: 18 },
];
const SLOTS = ["9:00", "9:45", "10:30", "11:15", "12:00", "12:45"];
const GALLERY = [1, 2, 3, 4, 5, 6].map((n) => `/home/gallery-${n}.webp`);
const BRAND_SWATCHES = ["#7c3aed", "#1d1a26", "#f4c7d8", "#e9e4f7"];

export function HomeClient() {
  const { t, locale } = useLanguage();
  const h = t.home;

  const price = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const services = h.mockServices.split("|").map((name, i) => ({ name, ...SERVICE_META[i] }));

  return (
    <div className="home-clay">
      {/* Hero: the copy + an auto-playing tour of example pages */}
      <HeroShowcase />

      {/* What's on the page: work, services, booking, brand */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:pb-24">
        <div className="mb-8 max-w-2xl sm:mb-12">
          <h2 className="text-3xl font-bold tracking-[-0.025em] sm:text-4xl">{h.featuresTitle}</h2>
          <p className="mt-4 text-lg leading-relaxed text-[color-mix(in_oklab,var(--clay-ink)_65%,transparent)]">
            {h.featuresDesc}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-5 lg:grid-cols-6">
          {/* Work */}
          <article className="clay flex flex-col rounded-[2rem] p-5 sm:p-8 lg:col-span-3">
            <h3 className="text-xl font-semibold tracking-tight">{h.featureWorkTitle}</h3>
            <p className="mt-2 max-w-sm leading-relaxed text-[color-mix(in_oklab,var(--clay-ink)_62%,transparent)]">
              {h.featureWorkDesc}
            </p>
            <div className="clay-well mt-6 grid grid-cols-3 gap-2.5 rounded-3xl p-3 sm:mt-8" aria-hidden>
              {GALLERY.map((src, i) => (
                <div
                  key={src}
                  className={`relative aspect-[5/4] overflow-hidden rounded-xl sm:rounded-2xl ${i === 1 ? "-translate-y-1.5 shadow-lg shadow-violet-900/15" : ""}`}
                >
                  <Image src={src} alt="" fill sizes={GALLERY_SIZES} className="object-cover" />
                </div>
              ))}
            </div>
          </article>

          {/* Services */}
          <article className="clay flex flex-col rounded-[2rem] p-5 sm:p-8 lg:col-span-3">
            <h3 className="text-xl font-semibold tracking-tight">{h.featureServicesTitle}</h3>
            <p className="mt-2 max-w-sm leading-relaxed text-[color-mix(in_oklab,var(--clay-ink)_62%,transparent)]">
              {h.featureServicesDesc}
            </p>
            <ul className="clay-well mt-6 space-y-2.5 rounded-3xl p-3 sm:mt-8" aria-hidden>
              {services.map((s, i) => (
                <li
                  key={s.name}
                  className={`clay flex items-center gap-3 rounded-2xl px-4 py-3 ${i === 0 ? "ring-2 ring-violet-500/70" : ""}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.name}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-[color-mix(in_oklab,var(--clay-ink)_55%,transparent)]">
                      <Clock className="h-3 w-3" />
                      {s.minutes} min
                    </span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{price.format(s.price)}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Booking */}
          <article className="clay flex flex-col gap-6 rounded-[2rem] p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-8 lg:col-span-4">
            <div className="sm:max-w-[16rem]">
              <h3 className="text-xl font-semibold tracking-tight">{h.featureBookingTitle}</h3>
              <p className="mt-2 leading-relaxed text-[color-mix(in_oklab,var(--clay-ink)_62%,transparent)]">
                {h.featureBookingDesc}
              </p>
            </div>
            <div className="clay-well grid flex-1 grid-cols-3 gap-2.5 rounded-3xl p-3" aria-hidden>
              {SLOTS.map((slot) => (
                <span
                  key={slot}
                  className={`rounded-xl py-2.5 text-center text-sm font-medium tabular-nums ${
                    slot === "10:30" ? "clay-violet" : "clay"
                  }`}
                >
                  {slot}
                </span>
              ))}
            </div>
          </article>

          {/* Brand */}
          <article className="clay flex flex-col rounded-[2rem] p-5 sm:p-8 lg:col-span-2">
            <h3 className="text-xl font-semibold tracking-tight">{h.featureBrandTitle}</h3>
            <p className="mt-2 leading-relaxed text-[color-mix(in_oklab,var(--clay-ink)_62%,transparent)]">
              {h.featureBrandDesc}
            </p>
            <div className="mt-auto flex items-center gap-2 pt-6 sm:pt-8" aria-hidden>
              {BRAND_SWATCHES.map((c) => (
                <span key={c} className="clay h-9 w-9 rounded-full ring-1 ring-black/5 dark:ring-white/15" style={{ background: c }} />
              ))}
            </div>
          </article>
        </div>
      </section>

      {/* Who it's for */}
      <AudienceSection />

      {/* How it works — a real sequence, so it's numbered */}
      <HowSection />

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-4 pb-16 sm:pb-24">
        <h2 className="mb-8 text-center sm:mb-10 text-3xl font-bold tracking-[-0.025em]">{h.faqTitle}</h2>
        <div className="space-y-3">
          {h.faq.map((item) => (
            <details key={item.q} className="clay group rounded-3xl px-6 py-5 open:pb-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="clay-well flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-violet-600 transition-transform group-open:rotate-45 dark:text-violet-400">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-[color-mix(in_oklab,var(--clay-ink)_65%,transparent)]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:pb-24">
        <div className="clay-violet relative overflow-hidden rounded-[2.5rem] px-6 py-14 sm:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/15 blur-3xl"
          />
          <div className="relative flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-[-0.025em] text-white">{h.ctaTitle}</h2>
              <p className="mt-3 text-lg text-violet-100/90">{h.ctaDesc}</p>
            </div>
            <Link
              href="/login?tab=signup"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold whitespace-nowrap text-violet-700 shadow-[inset_0_-3px_6px_rgb(124_58_237_/_0.15),0_12px_24px_-10px_rgb(30_10_80_/_0.5)] transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {h.ctaButton}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
