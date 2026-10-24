"use client";

import { Wordmark } from "./Wordmark";
import { NzLetterforms } from "./NzLetterforms";
import { useLanguage } from "@/contexts/LanguageContext";

// Full-page sign-in surfaces (login/signup, forgot + reset password): a brand
// panel in the logo violet on desktop, the form on the page color beside it.
// On mobile the panel gives way to a wordmark above the form. The wordmark is
// the way back home in both cases (these routes render no other chrome).
export function AuthSplitLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <aside className="relative hidden flex-col overflow-hidden bg-[#8C17FF] text-white lg:flex">
        <div className="relative z-10 p-10">
          <Wordmark tone="inverse" />
        </div>
        <p className="relative z-10 max-w-sm px-10 text-lg leading-relaxed text-white/80 text-balance">
          {t.auth.panelTagline}
        </p>
        <NzLetterforms className="auth-panel-mark absolute -bottom-[6%] -left-[7%] w-[118%] text-white" />
      </aside>

      <div
        data-clay-base
        className="flex flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),1.25rem)] sm:px-10"
      >
        <div className="flex h-12 items-center lg:hidden">
          <Wordmark />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="auth-panel-form w-full max-w-[24rem]">{children}</div>
        </div>
      </div>
    </div>
  );
}
