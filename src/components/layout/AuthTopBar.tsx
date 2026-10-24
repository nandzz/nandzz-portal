import { Wordmark } from "./Wordmark";

// Logo-only top bar for the sign-in pages: same page color as the content
// below (no border, no band), and the wordmark is the way back home.
export function AuthTopBar() {
  return (
    <header data-clay-base className="pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center px-4">
        <Wordmark />
      </div>
    </header>
  );
}
