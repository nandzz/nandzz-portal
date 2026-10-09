"use client";

import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { COMPANY, COMPANY_DETAILS_READY } from "@/features/legal/company";
import { getLegalUi } from "@/features/legal/i18n";

export function Footer() {
  const { t, locale } = useLanguage();
  const legalUi = getLegalUi(locale);

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
              <Link
                href="/acceptable-use"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {legalUi.footerAcceptableUse}
              </Link>
              <Link
                href="/dpa"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {legalUi.footerDpa}
              </Link>
              <Link
                href="/legal"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {legalUi.footerImprint}
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
              <Link
                href="/report"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {legalUi.footerReport}
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground/70">
            &copy; {new Date().getFullYear()}{" "}
            {COMPANY_DETAILS_READY
              ? `${COMPANY.legalName} · ${legalUi.footerVat} ${COMPANY.vatNumber} ·`
              : "nandzz."}{" "}
            {t.footer.rights}
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://www.producthunt.com/products/nandzz?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-nandzz"
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* Self-hosted copy of the Product Hunt badge: hot-linking it sent
                  every visitor's IP to producthunt.com. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Nandzz - Share what you create | Product Hunt"
                src="/producthunt-badge.svg"
                width={120}
                height={26}
                style={{ height: "26px", width: "auto" }}
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
