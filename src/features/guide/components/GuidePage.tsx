import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GuideCopy } from "../content";
import { GUIDE_VISUALS } from "./visuals";

const SIGNUP_HREF = "/login?tab=signup";

// Public walkthrough for business owners: hero, a jump row, then the setup
// steps as a numbered sequence (text beside an illustration), and a closing CTA.
export function GuidePage({ copy }: { copy: GuideCopy }) {
  return (
    <PageShell width="medium" className="py-16">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{copy.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground text-pretty">{copy.subtitle}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href={SIGNUP_HREF} className={buttonVariants({ size: "lg" })}>
            {copy.cta}
          </Link>
          <Link href="/pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {copy.pricingLink}
          </Link>
        </div>
      </header>

      <nav aria-label={copy.stepsLabel} className="scrollbar-hide -mx-4 mt-14 overflow-x-auto px-4">
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
                <h2 className="mt-5 text-2xl font-semibold tracking-tight">{step.title}</h2>
                <p className="mt-3 leading-7 text-muted-foreground">{step.body}</p>
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

      <p className="mt-20 text-sm text-muted-foreground">
        {copy.paidNote}{" "}
        <Link href="/pricing" className="font-medium text-foreground hover:underline">
          {copy.pricingLink}
        </Link>
      </p>

      <section className="mt-10 rounded-3xl bg-foreground px-6 py-12 text-background sm:px-12">
        <h2 className="text-3xl font-bold tracking-tight">{copy.closingTitle}</h2>
        <p className="mt-3 text-background/70">{copy.closingBody}</p>
        <Link href={SIGNUP_HREF} className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-8")}>
          {copy.cta}
        </Link>
      </section>
    </PageShell>
  );
}
