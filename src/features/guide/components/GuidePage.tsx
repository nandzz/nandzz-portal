import Link from "next/link";
import {
  CalendarCheck,
  Check,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { buttonVariants } from "@/components/ui/button";
import { HeroShowcase } from "@/features/home";
import { cn } from "@/lib/utils";
import type { GuideCopy } from "../content";
import { GUIDE_VISUALS } from "./visuals";

const SIGNUP_HREF = "/login?tab=signup";
const muted = "text-[color-mix(in_oklab,var(--clay-ink)_62%,transparent)]";

// Public guide for business owners, including the ones we built a page for:
// the home's showcase (with the guide's own headline), what the page includes
// for clients and for the business, the setup steps as a numbered sequence
// (text beside an illustration), questions on cost and claiming, and a closing CTA.
export function GuidePage({ copy }: { copy: GuideCopy }) {
  const sides = [
    { ...copy.what.clients, Icon: CalendarCheck },
    { ...copy.what.business, Icon: LayoutDashboard },
  ];

  return (
    <div className="home-clay">
      <HeroShowcase
        intro={{
          line1: copy.hero.line1,
          line2: copy.hero.line2,
          description: copy.hero.description,
          secondary: { href: "#what", label: copy.hero.whatLink },
        }}
      />

      <PageShell width="medium" className="pt-4 pb-16">
        <section id="what" className="scroll-mt-24">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {copy.what.title}
          </h2>
          <p
            className={cn(
              "mt-4 max-w-2xl text-lg leading-relaxed text-pretty",
              muted,
            )}
          >
            {copy.what.body}
          </p>
          <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-2">
            {sides.map(({ title, items, Icon }) => (
              <article key={title} className="clay rounded-[2rem] p-6 sm:p-8">
                <Icon
                  className="h-6 w-6 text-violet-600 dark:text-violet-400"
                  aria-hidden
                />
                <h3 className="mt-4 text-xl font-semibold tracking-tight">
                  {title}
                </h3>
                <ul className="mt-5 space-y-3">
                  {items.map((item) => (
                    <li
                      key={item}
                      className={cn("flex gap-3 leading-relaxed", muted)}
                    >
                      <Check
                        className="mt-1 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <header id="steps" className="mt-24 max-w-2xl scroll-mt-24 sm:mt-32">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {copy.title}
          </h2>
          <p className={cn("mt-4 text-lg text-pretty", muted)}>
            {copy.subtitle}
          </p>
        </header>

        <nav
          aria-label={copy.stepsLabel}
          className="scrollbar-hide -mx-4 mt-14 overflow-x-auto px-4"
        >
          <ol className="flex min-w-max gap-2 text-sm">
            {copy.steps.map((step, i) => (
              <li key={step.id}>
                <a
                  href={`#${step.id}`}
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                >
                  <span className="tabular-nums text-xs">{i + 1}</span>
                  {step.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <ol className="mt-16 space-y-20 sm:space-y-28">
          {copy.steps.map((step, i) => {
            const Visual = GUIDE_VISUALS[step.id];
            return (
              <li
                key={step.id}
                id={step.id}
                className="grid scroll-mt-24 items-center gap-8 md:grid-cols-2 md:gap-14"
              >
                <div className={i % 2 === 1 ? "md:order-2" : undefined}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background tabular-nums">
                    {i + 1}
                  </span>
                  <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                    {step.title}
                  </h2>
                  <p className="mt-3 leading-7 text-muted-foreground">
                    {step.body}
                  </p>
                  <ul className="mt-5 space-y-2 border-l pl-4 text-sm text-muted-foreground">
                    {step.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
                <div className="mx-auto w-full max-w-sm">
                  <Visual v={copy.visual} />
                </div>
              </li>
            );
          })}
        </ol>

        <p className={cn("mt-20 text-sm", muted)}>
          {copy.paidNote}{" "}
          <Link
            href="/pricing"
            className="font-medium text-[var(--clay-ink)] hover:underline"
          >
            {copy.pricingLink}
          </Link>
        </p>

        <section id="faq" className="mt-24 scroll-mt-24 sm:mt-32">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {copy.faqTitle}
          </h2>
          <div className="clay mt-8 divide-y divide-[color-mix(in_oklab,var(--clay-ink)_10%,transparent)] rounded-[2rem] px-6 sm:px-8">
            {copy.faq.map(({ q, a }) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    aria-hidden
                  />
                </summary>
                <p className={cn("mt-3 max-w-2xl leading-relaxed", muted)}>
                  {a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl bg-foreground px-6 py-12 text-background sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight">
            {copy.closingTitle}
          </h2>
          <p className="mt-3 text-background/70">{copy.closingBody}</p>
          <Link
            href={SIGNUP_HREF}
            className={cn(
              buttonVariants({ size: "lg", variant: "secondary" }),
              "mt-8",
            )}
          >
            {copy.cta}
          </Link>
        </section>
      </PageShell>
    </div>
  );
}
