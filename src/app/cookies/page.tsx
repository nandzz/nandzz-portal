import type { Metadata } from "next";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslations();
  return {
    title: t.meta.cookiesTitle,
    description: t.meta.cookiesDescription,
  };
}

export default function CookiesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Cookie Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: May 29, 2026
      </p>

      <div className="mt-10 space-y-8 text-muted-foreground leading-7">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. What Are Cookies
          </h2>
          <p className="mt-3">
            Cookies are small text files stored on your device when you visit a
            website. They help us provide a functional and secure experience by
            maintaining your session and remembering your preferences.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Cookies We Use
          </h2>
          <p className="mt-3">
            We currently use only essential cookies necessary for the Platform
            to function. We do not use advertising cookies or behavioral
            tracking cookies.
          </p>
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="font-medium text-foreground">
                Essential Cookies (Required)
              </h3>
              <p className="mt-1">
                These cookies are strictly necessary for the Platform to
                operate. They enable authentication, maintain your login
                session, and protect against security threats. The Platform
                cannot function without them.
              </p>
              <ul className="mt-2 list-disc pl-6 space-y-1">
                <li>
                  <span className="font-medium text-foreground">
                    Authentication cookies
                  </span>{" "}
                  — Maintain your login session across page visits
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Security cookies
                  </span>{" "}
                  — Protect against cross-site request forgery (CSRF) attacks
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Preference cookies
                  </span>{" "}
                  — Store your theme preference (light/dark mode)
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Third-Party Cookies
          </h2>
          <p className="mt-3">
            We use Supabase for authentication and data storage, which sets
            session cookies to manage your login securely. These cookies are
            governed by{" "}
            <a
              href="https://supabase.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              Supabase&apos;s Privacy Policy
            </a>
            . We do not use advertising cookies or share cookie data with
            third-party advertisers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Managing Cookies
          </h2>
          <p className="mt-3">
            You can control and delete cookies through your browser settings.
            Most browsers allow you to:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>View which cookies are stored on your device</li>
            <li>Delete individual or all cookies</li>
            <li>Block cookies from specific or all websites</li>
            <li>Set preferences for first-party vs. third-party cookies</li>
          </ul>
          <p className="mt-3">
            Please note that blocking essential cookies will prevent you from
            logging in and using core features of the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. Legal Basis for Cookies
          </h2>
          <p className="mt-3">
            Essential cookies are used on the basis of our legitimate interest
            in operating a secure and functional platform, and as strictly
            necessary to provide the service you have requested. No consent is
            required for essential cookies under applicable law.
          </p>
          <p className="mt-3">
            If we introduce non-essential cookies (such as analytics) in the
            future, we will update this policy and request your consent before
            placing them.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Changes to This Policy
          </h2>
          <p className="mt-3">
            We may update this Cookie Policy as our use of cookies evolves. Any
            changes will be reflected on this page with an updated date. If we
            begin using non-essential cookies, we will notify users via the
            Platform before doing so.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Contact Us
          </h2>
          <p className="mt-3">
            If you have questions about our use of cookies, contact us at{" "}
            <a
              href="mailto:support@nandzz.com"
              className="text-violet-600 hover:underline"
            >
              support@nandzz.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
