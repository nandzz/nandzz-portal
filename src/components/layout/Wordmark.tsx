import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The "nandzz" wordmark, linking home. Shared by the Navbar and the auth pages.
 * `inverse` renders it white for use on the violet brand panel.
 */
export function Wordmark({ tone = "default" }: { tone?: "default" | "inverse" }) {
  const inverse = tone === "inverse";
  return (
    <Link href="/" className={cn("flex items-center gap-0 group", inverse && "text-white")}>
      <span className="text-xl font-bold tracking-tight">nand</span>
      <span
        data-brand-accent
        className={cn(
          "text-xl font-bold tracking-tight transition-colors",
          inverse ? "text-white/70 group-hover:text-white" : "text-violet-600 group-hover:text-violet-500"
        )}
      >
        zz
      </span>
    </Link>
  );
}
