"use client";

import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="border-t bg-muted/20 dark:bg-muted/10 pb-16 md:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Image src="/logo.svg" alt="Nandzz logo" width={28} height={29} style={{ height: "auto" }} className="rounded-md" />
              <span className="font-semibold">nandzz</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t.footer.description}
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t.footer.platform}
              </span>
              <Link
                href="/explore"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.footer.explore}
              </Link>
              <Link
                href="/login?tab=signup"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.footer.getStarted}
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t.footer.legal}
              </span>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.footer.terms}
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.footer.privacy}
              </Link>
              <Link
                href="/cookies"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.footer.cookies}
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t.footer.support}
              </span>
              <Link
                href="/contact"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t.footer.contact}
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground/70">
            &copy; {new Date().getFullYear()} nandzz. {t.footer.rights}
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.producthunt.com/products/nandzz?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-nandzz"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Nandzz - Share what you create | Product Hunt"
                src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1158982&theme=light&t=1780131092412"
                width={120}
                height={26}
                style={{ height: "26px", width: "auto" }}
              />
            </a>
            <a
              href="https://www.buymeacoffee.com/felipenandz"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Buy Me A Coffee"
                src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
                width={100}
                height={28}
                style={{ height: "26px", width: "auto" }}
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
