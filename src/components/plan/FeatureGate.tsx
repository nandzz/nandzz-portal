import Link from "next/link";
import { Lock } from "lucide-react";

// Server component. Centered upgrade prompt shown when a user's plan doesn't
// include a feature (widgets / MCP / analytics). Copy is passed in so callers
// stay i18n-aware.
export function FeatureGate({
  title,
  description,
  ctaLabel,
  ctaHref = "/dashboard/subscription",
}: {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
        <Lock className="h-7 w-7 text-violet-600 dark:text-violet-400" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <Link
        href={ctaHref}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
