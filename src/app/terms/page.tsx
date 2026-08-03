import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | Nandzz",
  description: "Terms and conditions for using the nandzz platform.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        Terms &amp; Conditions
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: May 29, 2026
      </p>

      <div className="mt-10 space-y-8 text-muted-foreground leading-7">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            1. Acceptance of Terms
          </h2>
          <p className="mt-3">
            By accessing or using the nandzz platform (&quot;Platform&quot;),
            you agree to be bound by these Terms &amp; Conditions
            (&quot;Terms&quot;) and our{" "}
            <a href="/privacy" className="text-violet-600 hover:underline">
              Privacy Policy
            </a>
            . If you do not agree, do not use the Platform. These Terms
            constitute a legally binding agreement between you and nandzz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            2. Eligibility
          </h2>
          <p className="mt-3">
            You must be at least 13 years of age to use the Platform. By
            creating an account, you represent that you meet this age
            requirement. If you are between 13 and 18, you represent that you
            have obtained parental or guardian consent to use the Platform. We
            reserve the right to terminate accounts that we believe are held by
            users who do not meet the minimum age requirement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            3. Description of Service — Platform as Intermediary
          </h2>
          <p className="mt-3">
            nandzz is a neutral hosting and sharing platform that allows users
            to upload, save, and share web content — including HTML
            applications, PDFs, external URLs, and interactive creations
            (&quot;Spaces&quot;). Spaces may be set to public or private
            visibility.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">
              nandzz is an intermediary, not a publisher.
            </strong>{" "}
            We do not create, author, edit, curate, or endorse any User Content
            uploaded to the Platform. We do not pre-screen, monitor, or review
            content before it is published. All content is provided solely by
            users, and nandzz acts exclusively as a passive conduit and
            technical host for that content.
          </p>
          <p className="mt-3">
            nandzz is not responsible for and expressly disclaims all liability
            arising from User Content, including content that is inaccurate,
            offensive, indecent, objectionable, unlawful, or harmful. The
            existence of content on the Platform does not imply any approval,
            association, or endorsement by nandzz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            4. Sandboxed Content &amp; Third-Party Execution
          </h2>
          <p className="mt-3">
            The Platform renders certain User Content — including HTML files and
            external URLs — inside isolated, sandboxed environments (iframes)
            with restricted permissions. This technical measure is intended to
            limit the impact of potentially harmful code, but{" "}
            <strong className="text-foreground">
              nandzz does not guarantee that sandboxing will prevent all
              possible harm
            </strong>
            , and makes no warranty regarding the safety, security, or
            integrity of any content rendered through the Platform.
          </p>
          <p className="mt-3">
            When you access a Space containing third-party code, URLs, or
            embedded content, you do so entirely at your own risk. nandzz is
            not responsible for any damage to your device, data loss, privacy
            breaches, or any other harm resulting from executing or viewing
            User Content through the Platform.
          </p>
          <p className="mt-3">
            You acknowledge and agree that:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>
              Content rendered through the Platform may originate from and be
              controlled entirely by third parties
            </li>
            <li>
              External URLs embedded by users may redirect to websites outside
              nandzz&apos;s control
            </li>
            <li>
              nandzz has no ability to audit, verify, or validate the safety of
              user-submitted code or links before they are displayed
            </li>
            <li>
              Disabling JavaScript or using additional browser security tools is
              your own responsibility
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            5. User Accounts
          </h2>
          <p className="mt-3">
            You must create an account to use certain features of the Platform.
            You are responsible for:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Maintaining the confidentiality of your login credentials</li>
            <li>
              All activity that occurs under your account, whether authorized by
              you or not
            </li>
            <li>
              Notifying us immediately at{" "}
              <a
                href="mailto:support@nandzz.com"
                className="text-violet-600 hover:underline"
              >
                support@nandzz.com
              </a>{" "}
              if you suspect unauthorized access to your account
            </li>
          </ul>
          <p className="mt-3">
            You may not create accounts for the purpose of impersonating another
            person or entity, or for automated or bulk account creation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            6. User Content &amp; License
          </h2>
          <p className="mt-3">
            You retain ownership of all content you upload to the Platform
            (&quot;User Content&quot;). By uploading content, you grant nandzz
            a non-exclusive, worldwide, royalty-free, sublicensable license to
            host, store, display, reproduce, and distribute your User Content
            solely as necessary to operate and provide the Platform.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">
              You are solely and exclusively responsible for your User Content.
            </strong>{" "}
            You represent and warrant that:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>
              You own or have all necessary rights, licenses, and permissions to
              upload and share your User Content
            </li>
            <li>Your User Content does not violate any applicable law or regulation</li>
            <li>
              Your User Content does not infringe the intellectual property,
              privacy, publicity, or other rights of any third party
            </li>
            <li>Your User Content does not contain malware, viruses, exploits, spyware, adware, trojans, ransomware, or any other harmful or malicious code</li>
            <li>
              Your User Content does not constitute harassment, hate speech,
              threats, incitement to violence, or content that promotes
              discrimination based on race, ethnicity, nationality, religion,
              gender, sexual orientation, disability, or any other protected
              characteristic
            </li>
            <li>
              Your User Content does not include sexually explicit material
              involving minors (CSAM) — any such content will be reported to
              the appropriate authorities immediately
            </li>
            <li>
              Your User Content does not include personally identifiable
              information of others without their explicit consent
            </li>
            <li>
              Your User Content does not impersonate any person or entity or
              misrepresent your affiliation with any person or entity
            </li>
            <li>
              Your User Content does not facilitate phishing, fraud, or
              deceptive practices
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            7. Prohibited Uses
          </h2>
          <p className="mt-3">You may not use the Platform to:</p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Send spam or unsolicited bulk communications</li>
            <li>
              Attempt to gain unauthorized access to other accounts, systems,
              or networks
            </li>
            <li>
              Interfere with, disrupt, or overburden the Platform&apos;s
              infrastructure
            </li>
            <li>Scrape or harvest user data without our written permission</li>
            <li>Use automated tools to create accounts in bulk</li>
            <li>Circumvent any access controls, sandboxing, or security measures</li>
            <li>Distribute or facilitate the distribution of malicious code</li>
            <li>Conduct phishing attacks or engage in social engineering</li>
            <li>Upload content that is designed to exploit or harm viewers</li>
            <li>Use the Platform for any purpose that violates applicable law</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            8. Content Moderation &amp; Reporting
          </h2>
          <p className="mt-3">
            nandzz does not pre-screen User Content but reserves the right —
            without obligation — to review, remove, or restrict access to any
            content that we determine, in our sole discretion, violates these
            Terms, is potentially harmful, or is otherwise objectionable.
          </p>
          <p className="mt-3">
            To report content that you believe violates these Terms, is illegal,
            or is harmful, please contact us at{" "}
            <a
              href="mailto:support@nandzz.com"
              className="text-violet-600 hover:underline"
            >
              support@nandzz.com
            </a>{" "}
            with a description of the content and the URL of the Space. We will
            review reports and take appropriate action, which may include
            removing the content and/or suspending the account responsible.
          </p>
          <p className="mt-3">
            Reports of illegal content — including CSAM, credible threats of
            violence, or content that facilitates crimes — will be escalated to
            the appropriate law enforcement authorities.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            9. Intellectual Property &amp; DMCA Safe Harbor
          </h2>
          <p className="mt-3">
            We respect intellectual property rights and comply with the Digital
            Millennium Copyright Act (17 U.S.C. § 512). If you believe in good
            faith that content on the Platform infringes your copyright, you may
            submit a takedown notice to our designated DMCA agent at{" "}
            <a
              href="mailto:support@nandzz.com"
              className="text-violet-600 hover:underline"
            >
              support@nandzz.com
            </a>
            . Your notice must include:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>
              Identification of the copyrighted work you claim has been infringed
            </li>
            <li>
              Identification of the allegedly infringing material and its
              location on the Platform (URL)
            </li>
            <li>
              Your full name, address, telephone number, and email address
            </li>
            <li>
              A statement that you have a good-faith belief that the disputed use
              is not authorized by the copyright owner, its agent, or the law
            </li>
            <li>
              A statement, made under penalty of perjury, that the information in
              your notice is accurate, and that you are the copyright owner or
              are authorized to act on behalf of the copyright owner
            </li>
            <li>Your electronic or physical signature</li>
          </ul>
          <p className="mt-3">
            Submitting a knowingly false DMCA notice may expose you to liability
            under 17 U.S.C. § 512(f). Upon receiving a valid notice, we will
            remove or disable access to the allegedly infringing content and
            notify the user who uploaded it, who may file a counter-notice.
          </p>
          <p className="mt-3">
            The nandzz name, logo, and all related trademarks are the exclusive
            property of nandzz. You may not use them without our prior written
            consent.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            10. Indemnification
          </h2>
          <p className="mt-3">
            You agree to defend, indemnify, and hold harmless nandzz and its
            affiliates, officers, directors, employees, contractors, agents,
            licensors, and successors from and against any and all claims,
            damages, losses, costs, and expenses (including reasonable
            attorneys&apos; fees) arising out of or relating to:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Your use of or inability to use the Platform</li>
            <li>Your User Content</li>
            <li>
              Your violation of these Terms or any applicable law or regulation
            </li>
            <li>
              Your violation of any third party&apos;s rights, including
              intellectual property rights, privacy rights, or publicity rights
            </li>
            <li>
              Any harm caused by code, scripts, or content you upload or share
              through the Platform
            </li>
          </ul>
          <p className="mt-3">
            This indemnification obligation will survive termination of your
            account and your cessation of use of the Platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            11. Termination
          </h2>
          <p className="mt-3">
            We reserve the right to suspend or permanently terminate your
            account, with or without notice, if you violate these Terms or
            engage in conduct we determine to be harmful to the Platform or its
            users. Where practical, we will notify you and give you an
            opportunity to resolve the issue before termination.
          </p>
          <p className="mt-3">
            You may delete your account at any time through your account
            settings. Upon deletion, your personal data will be removed in
            accordance with our{" "}
            <a href="/privacy" className="text-violet-600 hover:underline">
              Privacy Policy
            </a>
            . Public Spaces associated with your account may be removed or
            rendered inaccessible upon account deletion.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            12. Disclaimer of Warranties
          </h2>
          <p className="mt-3">
            The Platform is provided &quot;as is&quot; and &quot;as
            available&quot; without warranties of any kind, either express or
            implied, including but not limited to warranties of merchantability,
            fitness for a particular purpose, title, or non-infringement. We do
            not warrant that the Platform will be uninterrupted, error-free, or
            free of harmful components.
          </p>
          <p className="mt-3">
            <strong className="text-foreground">
              nandzz makes no representations or warranties of any kind
              regarding any User Content
            </strong>
            , including its accuracy, legality, safety, or appropriateness.
            Your use of or reliance on any User Content is entirely at your own
            risk. nandzz is not responsible for any harm, damage, or loss
            resulting from your access to or use of User Content on the
            Platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            13. Limitation of Liability
          </h2>
          <p className="mt-3">
            To the maximum extent permitted by applicable law, nandzz and its
            affiliates, officers, employees, and agents shall not be liable for
            any indirect, incidental, special, consequential, or punitive
            damages — including loss of profits, data, business, goodwill, or
            savings — arising from:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1">
            <li>Your use of or inability to use the Platform</li>
            <li>
              Any User Content accessed, viewed, or executed through the
              Platform
            </li>
            <li>
              Unauthorized access to or alteration of your account or data
            </li>
            <li>
              Conduct of any third party on the Platform
            </li>
            <li>Any other matter relating to the Platform</li>
          </ul>
          <p className="mt-3">
            This limitation applies even if nandzz has been advised of the
            possibility of such damages. Our total aggregate liability to you
            for any claim arising out of or relating to the Platform shall not
            exceed the greater of (a) the amounts you have paid to nandzz in
            the twelve months preceding the claim, or (b) USD $50.
          </p>
          <p className="mt-3">
            Some jurisdictions do not allow the exclusion or limitation of
            certain damages. In such jurisdictions, nandzz&apos;s liability
            will be limited to the maximum extent permitted by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            14. Changes to Terms
          </h2>
          <p className="mt-3">
            We may update these Terms from time to time. We will notify you of
            material changes by posting a notice on the Platform and, where
            required, by email at least 14 days before the changes take effect.
            Your continued use of the Platform after changes take effect
            constitutes your acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            15. Governing Law &amp; Dispute Resolution
          </h2>
          <p className="mt-3">
            These Terms are governed by and construed in accordance with
            applicable law. Any dispute arising out of or in connection with
            these Terms shall first be attempted to be resolved through good
            faith negotiation between the parties. If unresolved within 30 days,
            disputes shall be subject to the exclusive jurisdiction of the
            competent courts of the jurisdiction where nandzz is established.
          </p>
          <p className="mt-3">
            To the extent permitted by law, you waive any right to participate
            in a class action lawsuit or class-wide arbitration against nandzz.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            16. Severability
          </h2>
          <p className="mt-3">
            If any provision of these Terms is found to be unenforceable or
            invalid under applicable law, that provision will be limited or
            eliminated to the minimum extent necessary, and the remaining
            provisions of these Terms will remain in full force and effect.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            17. Contact
          </h2>
          <p className="mt-3">
            If you have questions about these Terms, wish to report content, or
            need to submit a DMCA notice, please contact us at{" "}
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
