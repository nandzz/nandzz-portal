import { cn } from "@/lib/utils";

// Single source of truth for the app page frame. Every page and its matching
// loading.tsx skeleton renders through this so the gutters stay identical
// across routes (and between skeleton and content). The padding model mirrors
// the credits page — `mx-auto … px-4 py-12` — now that the fixed Sidebar
// offsets <main>; hand-rolled per-page containers were producing uneven gutters
// and skeleton→content width jumps.

export type PageWidth = "narrow" | "content" | "medium" | "wide";

// Keep the per-page max-widths that make sense for their content (forms narrow,
// card grids wide) while unifying the horizontal/vertical padding + centering.
const WIDTHS: Record<PageWidth, string> = {
  narrow: "max-w-3xl", // forms, billing, settings
  content: "max-w-4xl", // credits (the reference), reading-width content
  medium: "max-w-5xl", // widgets
  wide: "max-w-7xl", // card grids: dashboard, explore, feed, collections
};

interface PageShellProps {
  width?: PageWidth;
  className?: string;
  children: React.ReactNode;
}

export function PageShell({ width = "content", className, children }: PageShellProps) {
  return (
    <div
      className={cn(
        // Comfortable, responsive side gutters so wide grids don't jam against
        // the Sidebar / viewport edge — the roomy feel of the credits page,
        // which only looked padded because its narrow max-width centred it.
        "mx-auto w-full px-4 py-12 sm:px-6 lg:px-8",
        WIDTHS[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
