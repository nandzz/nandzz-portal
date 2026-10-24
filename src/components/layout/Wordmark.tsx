import Link from "next/link";

/** The "nandzz" wordmark, linking home. Shared by the Navbar and AuthTopBar. */
export function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-0 group">
      <span className="text-xl font-bold tracking-tight">nand</span>
      <span data-brand-accent className="text-xl font-bold tracking-tight text-violet-600 transition-colors group-hover:text-violet-500">zz</span>
    </Link>
  );
}
