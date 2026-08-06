import type { Metadata } from "next";
import { getServerTranslations } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerTranslations();
  return {
    title: t.meta.privacyTitle,
    description: t.meta.privacyDescription,
  };
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: May 29, 2026
      </p>

      <div className="mt-10 space-y-8 text-muted-foreground leading-7">
        <section>
          <p>
            nandzz (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates
            the nandzz platform (&quot;Platform&quot;). This Privacy Policy
            explains how we collect, use, and protect your personal information
            when you use the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Data Controller
          </h2>
          <p className="mt-3">
            nandzz is the data controller responsible for your personal
            information. You can reach us at{" "}
            <a
              href="mailto:support@nandzz.com"
              className="text-violet-600 hover:underline"
            >
              support@nandzz.com
            </a>{" "}
            for any privacy-related requests.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Information We Collect
          </h2>
          <p className="mt-3">
            <span className="font-medium text-foreground">
              Information you provide:
            </span>{" "}
            When you create an account, we collect your email address,
            username, and any profile information you choose to add. We also
            collect content you upload or create on the Platform
            (&quot;Content&quot;).
          </p>
          <p className="mt-3">
            <span className="font-medium text-foreground">
              Automatically collected information:
            </span>{" "}
            Our hosting infrastructure (Vercel) and authentication provider
            (Supabase) collect standard server logs, which may include your IP
            address, browser type, and request metadata. We do not run
            independent analytics trackers on the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. How We Use Your Information
          </h2>
          <p className="mt-3">
            We process your personal data on the following legal bases:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-2">
            <li>
              <span className="font-medium text-foreground">
                Contract performance:
              </span>{" "}
              to create and manage your account, display your Content, and
              process your subscription.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Legitimate interests:
              </span>{" "}
              to maintain the security and integrity of the Platform, detect
              fraud or abuse, and improve our service.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Legal obligation:
              </span>{" "}
              to comply with applicable laws and respond to lawful requests
              from authorities.
            </li>
            <li>
              <span className="font-medium text-foreground">Consent:</span>{" "}
              for any optional communications such as newsletters or
              promotional emails.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Information Sharing
          </h2>
          <p className="mt-3">
            We do not sell your personal information. We share your data only
            in these limited circumstances:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>
              <span className="font-medium text-foreground">
                Service providers:
              </span>{" "}
              Supabase (authentication and database) and Vercel (hosting),
              each bound by their own data processing agreements.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Legal requirements:
              </span>{" "}
              when required by law, court order, or governmental authority.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Protection of rights:
              </span>{" "}
              to protect the safety, rights, or property of nandzz, our users,
              or the public.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Business transfers:
              </span>{" "}
              in the event of a merger, acquisition, or sale of assets, your
              data may be transferred as part of that transaction.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. International Data Transfers
          </h2>
          <p className="mt-3">
            Your data may be stored and processed in countries outside your
            own, including the United States, where our service providers
            operate. Where required, we rely on appropriate safeguards such as
            Standard Contractual Clauses to protect cross-border transfers of
            personal data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. Data Storage &amp; Security
          </h2>
          <p className="mt-3">
            Your data is stored using Supabase, which employs encryption at
            rest and in transit (TLS). We implement access controls and
            security best practices appropriate for a platform of our size.
            However, no system is completely secure and we cannot guarantee
            absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Data Retention
          </h2>
          <p className="mt-3">
            We retain your account data for as long as your account is active.
            When you delete your account, we will remove your personal data
            within 30 days, except where we are required by law to retain it
            longer (e.g., billing records for tax purposes, which we retain for
            up to 7 years).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Your Rights
          </h2>
          <p className="mt-3">
            Depending on your location, you may have the following rights
            regarding your personal data:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>
              <span className="font-medium text-foreground">Access:</span>{" "}
              request a copy of the personal data we hold about you.
            </li>
            <li>
              <span className="font-medium text-foreground">Correction:</span>{" "}
              request that we correct inaccurate or incomplete data.
            </li>
            <li>
              <span className="font-medium text-foreground">Deletion:</span>{" "}
              request deletion of your account and associated personal data.
            </li>
            <li>
              <span className="font-medium text-foreground">Portability:</span>{" "}
              request a copy of your data in a machine-readable format.
            </li>
            <li>
              <span className="font-medium text-foreground">Objection:</span>{" "}
              object to processing based on legitimate interests.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Withdraw consent:
              </span>{" "}
              withdraw consent at any time where processing is based on
              consent.
            </li>
          </ul>
          <p className="mt-3">
            To exercise these rights, contact us at{" "}
            <a
              href="mailto:support@nandzz.com"
              className="text-violet-600 hover:underline"
            >
              support@nandzz.com
            </a>
            . We will respond within 30 days. You also have the right to lodge
            a complaint with your local data protection authority.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Children&apos;s Privacy
          </h2>
          <p className="mt-3">
            The Platform is not directed at children under 13 years of age. We
            do not knowingly collect personal data from children under 13. If
            you believe we have inadvertently collected such data, please
            contact us immediately and we will delete it promptly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. Changes to This Policy
          </h2>
          <p className="mt-3">
            We may update this Privacy Policy from time to time. We will notify
            you of material changes by posting a notice on the Platform and,
            where appropriate, by email. The updated policy will include a
            revised &quot;Last updated&quot; date. Your continued use of the
            Platform after changes are posted constitutes your acceptance of
            the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            11. Contact Us
          </h2>
          <p className="mt-3">
            For any questions or concerns about this Privacy Policy, or to
            exercise your data rights, contact us at{" "}
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
