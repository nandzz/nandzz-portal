"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Briefcase, ChevronRight, User } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { consumeWelcomePending } from "@/lib/onboarding/welcomeFlag";

const BecomeBusinessDialog = dynamic(() =>
  import("./BecomeBusinessDialog").then((m) => m.BecomeBusinessDialog),
);

// Shown once, right after a home-page signup lands on the new profile: asks
// whether the account is for a business and, if so, goes straight into the
// switch (category + address). Everyone is personal by default, so "client"
// just closes it.
export function WelcomeAccountTypeDialog() {
  const { t } = useLanguage();
  const { userId, profile } = useAuth();
  const [step, setStep] = useState<"closed" | "choose" | "business">("closed");

  useEffect(() => {
    if (!userId || !profile) return;
    if (!consumeWelcomePending()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot open driven by the post-signup marker in localStorage
    if (profile.account_type !== "business") setStep("choose");
  }, [userId, profile]);

  if (step === "closed") return null;

  if (step === "business") {
    return (
      <BecomeBusinessDialog
        open
        onClose={() => setStep("closed")}
        initialCategory={profile?.category}
        initialAddress={profile?.address}
      />
    );
  }

  const options = [
    {
      id: "business" as const,
      icon: Briefcase,
      title: t.nav.welcomeBusiness,
      desc: t.nav.welcomeBusinessDesc,
      onClick: () => setStep("business"),
    },
    {
      id: "personal" as const,
      icon: User,
      title: t.nav.welcomePersonal,
      desc: t.nav.welcomePersonalDesc,
      onClick: () => setStep("closed"),
    },
  ];

  return (
    <Dialog open onClose={() => setStep("closed")} title={t.nav.welcomeTitle}>
      <p className="text-sm text-muted-foreground mb-4">{t.nav.welcomeDesc}</p>
      <div className="flex flex-col gap-2">
        {options.map(({ id, icon: Icon, title, desc, onClick }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className="group flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/60 dark:hover:border-violet-800 dark:hover:bg-violet-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300">
              <Icon aria-hidden className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{title}</span>
              <span className="block text-xs text-muted-foreground">{desc}</span>
            </span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t.nav.welcomeLater}</p>
    </Dialog>
  );
}
