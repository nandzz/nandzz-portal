import { COMPANY as C, MIN_AGE, MIN_BUSINESS_AGE } from "../company";
import { A, B, Mail, P, Summary, Ul } from "../components/primitives";
import type { LegalDocument } from "../types";

export const termsEn: LegalDocument = {
  title: "Terms of Service",
  subtitle: "The agreement between you and Nandzz for using nandzz.com.",
  intro: (
    <Summary title="The short version">
      <Ul>
        <li>Nandzz is a social platform that connects businesses and their clients: a branded page that brings together your bookings, content and links, so you get found and booked.</li>
        <li>You own your content. You give us only the rights we need to run the service.</li>
        <li>Paid plans renew automatically. You can cancel anytime in your dashboard, and the plan runs until the end of the period you paid for.</li>
        <li>If you run a business on Nandzz, you are responsible for your customers&apos; data and bookings. We process that data for you under our <A href="/dpa">DPA</A>.</li>
        <li>If you are a consumer, nothing in these Terms takes away the rights mandatory law gives you.</li>
      </Ul>
      <P>This summary is not part of the Terms. Please read the full text below.</P>
    </Summary>
  ),
  sections: [
    {
      id: "agreement",
      title: "Who we are and this agreement",
      body: (
        <>
          <P>
            Nandzz (the &quot;<B>Service</B>&quot;) is operated by <B>{C.legalName}</B>, registered office{" "}
            {C.registeredOffice}, VAT {C.vatNumber} (&quot;<B>Nandzz</B>&quot;, &quot;<B>we</B>&quot;,
            &quot;<B>us</B>&quot;). Our full company details are in the <A href="/legal">Legal notice</A>.
          </P>
          <P>
            These Terms form a binding contract between you and Nandzz. To use the Service you must accept
            them. Several other documents form part of these Terms:
          </P>
          <Ul>
            <li>the <A href="/acceptable-use">Acceptable Use Policy</A></li>
            <li>the <A href="/dpa">Data Processing Agreement</A>, for business accounts</li>
            <li>the plan details shown at purchase</li>
          </Ul>
          <P>
            Our <A href="/privacy">Privacy Policy</A> and <A href="/cookies">Cookie Policy</A> explain how we
            handle personal data. They are notices to you, not contract terms.
          </P>
          <P>
            &quot;<B>Consumer</B>&quot; means an individual acting for purposes outside their trade, business,
            craft or profession. &quot;<B>Business user</B>&quot; means anyone using the Service for those
            purposes. Several sections treat these two groups differently.
          </P>
        </>
      ),
    },
    {
      id: "service",
      title: "The Service",
      body: (
        <>
          <P>Nandzz lets you:</P>
          <Ul>
            <li>create a public page under your username</li>
            <li>publish content on it, such as web pages, files, gallery items and links</li>
            <li>offer features on it, such as online appointment booking</li>
            <li>connect with other users, for example by following pages, saving content to collections and booking appointments</li>
          </Ul>
          <P>
            Some features are free and others need a paid plan or credits. What each plan includes is shown on
            our <A href="/pricing">pricing page</A> and at checkout.
          </P>
          <P>
            We keep improving the Service and may add, change or remove features. If a change materially
            reduces a paid feature you are currently paying for, we will tell you in advance. You may then
            cancel and receive a pro-rata refund of any prepaid, unused period.
          </P>
        </>
      ),
    },
    {
      id: "eligibility",
      title: "Eligibility and your account",
      body: (
        <>
          <P>
            You must be at least <B>{MIN_AGE}</B> to create an account. If you are under the age of majority
            where you live, you confirm that a parent or guardian has agreed to these Terms on your behalf.
          </P>
          <P>
            You must be at least <B>{MIN_BUSINESS_AGE}</B> and have authority to bind the business to:
          </P>
          <Ul>
            <li>use the Service for a business</li>
            <li>accept bookings or payments through it</li>
            <li>buy a paid plan</li>
          </Ul>
          <P>
            Keep your account details accurate and your password confidential. You are responsible for activity
            under your account unless it happened because of our failure. Tell us right away at{" "}
            <Mail to={C.emails.support} /> if you suspect unauthorised access.
          </P>
          <P>
            Usernames are first-come, first-served. We may reclaim a username that:
          </P>
          <Ul>
            <li>impersonates someone</li>
            <li>infringes a trademark</li>
            <li>is inactive and requested by a rights holder</li>
          </Ul>
        </>
      ),
    },
    {
      id: "business-users",
      title: "Using Nandzz for your business",
      body: (
        <>
          <P>If you use the Service for a business, including to take bookings:</P>
          <Ul>
            <li>
              You are the <B>data controller</B> of your customers&apos; personal data, such as names, phone
              numbers, emails, notes and chat messages. We act as your <B>processor</B> under the{" "}
              <A href="/dpa">Data Processing Agreement</A>, which you accept by accepting these Terms.
            </li>
            <li>
              You must give your customers the information required by data-protection law. Our booking pages
              link to our Privacy Policy, which explains our role. You remain responsible for your own privacy
              notice, and for having a lawful basis for any messages you send.
            </li>
            <li>
              The contract for any service you offer through a booking is between you and your customer.
              Nandzz is not a party to it. You are solely responsible for:
              <Ul>
                <li>your services, prices, cancellation rules, opening hours and staff</li>
                <li>the accuracy of what you publish</li>
                <li>complying with consumer, tax and sector rules that apply to you</li>
              </Ul>
            </li>
            <li>
              You will not use the Service to send marketing or other messages to customers without their
              prior consent where the law requires it.
            </li>
          </Ul>
          <P>
            Business users acknowledge that the consumer-protection provisions in these Terms do not apply to
            them, except where mandatory law says otherwise.
          </P>
        </>
      ),
    },
    {
      id: "payments",
      title: "Plans, trials, credits and payments",
      body: (
        <>
          <P>
            <B>Prices.</B> Prices are shown before you pay. For consumers they include VAT. We may add VAT or
            other taxes for business users where applicable. Payments are processed by Stripe. We never see or
            store your full card details.
          </P>
          <P>
            <B>Subscriptions renew automatically.</B> A paid plan renews at the end of each billing period
            (monthly or yearly) at the then-current price, until you cancel. You can cancel at any time from
            your dashboard, under Billing / Manage subscription. Cancellation takes effect at the end of the
            current period, and you keep access until then. We will tell you about any price increase at least
            30 days before it applies to you. You may cancel before then.
          </P>
          <P>
            <B>Free trials.</B> If a plan includes a free trial, the trial length and the price that follows are
            shown at checkout. The first payment is taken when the trial ends unless you cancel before. Each
            account can use one trial.
          </P>
          <P>
            <B>Credits.</B> Some features, like AI usage, consume credits.
          </P>
          <Ul>
            <li>
              <B>Plan credits</B> are included with a plan. They reset at each billing period and do not roll
              over.
            </li>
            <li>
              <B>Purchased credits</B> do not expire while your account exists.
            </li>
            <li>
              Credits have no cash value. They are not transferable and can only be used on Nandzz.
            </li>
            <li>
              Unused credits are lost when you delete your account, except where a refund is due under
              section 6 or mandatory law.
            </li>
          </Ul>
          <P>
            <B>Failed payments.</B> If a renewal payment fails, we may retry it and downgrade the account to the
            free plan after a reasonable grace period. Your content stays available on the free plan, within
            its limits.
          </P>
          <P>
            <B>Refunds.</B> Apart from section 6 and your statutory rights, payments are non-refundable. Partial
            billing periods are not refunded after you cancel. We will always refund amounts charged in error.
          </P>
        </>
      ),
    },
    {
      id: "withdrawal",
      title: "Right of withdrawal (EU/UK consumers)",
      body: (
        <>
          <P>
            If you are a consumer in the EU, EEA or UK, you have a <B>14-day right of withdrawal</B> from a
            distance contract without giving a reason. For Italy, see Arts. 52 et seq. of the Consumer Code
            (D.Lgs. 206/2005).
          </P>
          <Ul>
            <li>
              <B>Subscriptions (digital service).</B> You may withdraw within 14 days of subscribing.
              <Ul>
                <li>
                  If you asked the service to start during that period, which happens when you subscribe and
                  start using paid features, we refund the payment minus an amount proportional to the service
                  provided up to withdrawal.
                </li>
                <li>
                  Free-trial days are not charged.
                </li>
              </Ul>
            </li>
            <li>
              <B>Credit packs (digital content).</B> Credits are delivered to your account immediately.
              <Ul>
                <li>
                  At checkout you expressly request immediate delivery and acknowledge that you{" "}
                  <B>lose your right of withdrawal</B> once the credits are credited (Art. 59(1)(o) Consumer
                  Code).
                </li>
                <li>
                  If you have not used any credits from the pack, write to us within 14 days and we will still
                  refund it as a courtesy.
                </li>
              </Ul>
            </li>
          </Ul>
          <P>
            To withdraw, send a clear statement to <Mail to={C.emails.support} /> from your account email. You
            may use this model:
          </P>
          <P>
            &quot;I hereby give notice that I withdraw from my contract for [plan/credit pack], ordered on
            [date]. Name, account email, date.&quot;
          </P>
          <P>
            We refund within 14 days using the original payment method.
          </P>
        </>
      ),
    },
    {
      id: "content",
      title: "Your content",
      body: (
        <>
          <P>
            You keep all rights in what you upload or publish (&quot;<B>Your Content</B>&quot;). This includes
            text, images, files, HTML pages, links, documents given to your AI agent, and your branding.
          </P>
          <P>
            You give Nandzz a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, adapt
            and display Your Content. The licence covers:
          </P>
          <Ul>
            <li>technical adaptation, such as resizing, generating previews and indexing</li>
            <li>showing Your Content on your page and in other parts of the Service</li>
          </Ul>
          <P>
            We use this licence only to provide, secure and improve the Service, and to show Your Content as
            you set it (public or private). We may sublicense it only to our sub-processors for those purposes.
            The licence ends when you delete the content or your account, except for:
          </P>
          <Ul>
            <li>copies held in backups for a limited period</li>
            <li>copies we must keep by law</li>
          </Ul>
          <P>
            We do not use Your Content or your customers&apos; data to train AI models. We do not allow our AI
            providers to do so either.
          </P>
          <P>
            You confirm that you have all rights needed to publish Your Content. You also confirm that it
            complies with the law and with our <A href="/acceptable-use">Acceptable Use Policy</A>.
          </P>
          <P>
            Content you publish publicly can be seen, linked to and shared by anyone. Make sure you are
            comfortable with that before publishing.
          </P>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: (
        <P>
          You must follow the <A href="/acceptable-use">Acceptable Use Policy</A>. In short, no illegal,
          harmful, deceptive or infringing content or behaviour, and no attempts to break, overload or abuse the
          Service, other users or your customers.
        </P>
      ),
    },
    {
      id: "moderation",
      title: "Notices, moderation and complaints",
      body: (
        <>
          <P>
            We act as a hosting service under the EU Digital Services Act (Regulation (EU) 2022/2065,
            &quot;DSA&quot;). We do not review content before it is published. We act on notices and may
            proactively look into content that may break the law or our policies.
          </P>
          <Ul>
            <li>
              <B>Report content</B> through our <A href="/report">reporting form</A> or the &quot;Report&quot;
              link on public pages. We process notices diligently and without undue delay, and tell the
              reporter about our decision.
            </li>
            <li>
              <B>Possible actions</B> we may take:
              <Ul>
                <li>remove or disable content</li>
                <li>restrict its visibility or features</li>
                <li>suspend or close an account</li>
              </Ul>
              We act proportionately, taking into account how serious, how often and how intentional the
              breach is.
            </li>
            <li>
              <B>Statement of reasons.</B> When we restrict your content or account, we tell you what we did,
              why, and how to contest it. The only exceptions are where the law prohibits this, or where the
              content is deceptive high-volume commercial content.
            </li>
            <li>
              <B>Complaints.</B> You can contest any decision within 6 months by replying to our notice or
              writing to <Mail to={C.emails.dsa} />. A person, not just an automated system, reviews complaints.
              You may also use a certified out-of-court dispute settlement body under Art. 21 DSA, or go to
              court.
            </li>
            <li>
              <B>Misuse.</B> We may suspend, for a reasonable period and after a warning, users who:
              <Ul>
                <li>frequently post manifestly illegal content</li>
                <li>frequently submit manifestly unfounded notices</li>
              </Ul>
            </li>
            <li>
              <B>Criminal offences.</B> We report to authorities any information giving rise to a suspicion of
              a criminal offence involving a threat to life or safety. We also report child sexual abuse
              material.
            </li>
          </Ul>
          <P>
            Our single point of contact for authorities and users under the DSA is <Mail to={C.emails.dsa} />.
            We communicate in English and Italian.
          </P>
        </>
      ),
    },
    {
      id: "intellectual-property",
      title: "Intellectual property",
      body: (
        <>
          <P>
            The Service, its software and design, and the Nandzz name and logo belong to us or our licensors.
            You may not use them without our written permission, except to refer to the Service accurately.
          </P>
          <P>
            If you believe content on Nandzz infringes your copyright or another right, use the{" "}
            <A href="/report">reporting form</A>. Select &quot;Intellectual property&quot; and identify the
            work and the infringing URL.
          </P>
          <P>
            <B>US copyright notices (DMCA).</B> Rights holders in the United States may also send a notice under
            17 U.S.C. § 512 to <Mail to={C.emails.legal} />. The notice must include:
          </P>
          <Ul>
            <li>the work you claim is infringed</li>
            <li>the infringing URL</li>
            <li>your contact details</li>
            <li>a good-faith statement</li>
            <li>a statement, under penalty of perjury, that you are authorised to act</li>
            <li>your signature</li>
          </Ul>
          <P>
            The uploader may send a counter-notice. We disable the accounts of repeat infringers.
          </P>
        </>
      ),
    },
    {
      id: "ai",
      title: "AI features",
      body: (
        <>
          <P>
            Some features may use artificial intelligence, such as AI-assisted editing. Where an AI system
            talks to visitors, it tells them they are talking to an AI system, as required by the EU AI Act. Business
            users must not hide or remove that notice.
          </P>
          <P>
            AI output is generated automatically and may be inaccurate, incomplete or inappropriate. Check
            important information before relying on it.
          </P>
          <P>
            Business users are responsible for:
          </P>
          <Ul>
            <li>the documents and instructions they give their agent</li>
            <li>any answers they let it give on their behalf</li>
          </Ul>
          <P>
            Do not use AI features to make decisions with legal or similarly significant effects on people.
          </P>
        </>
      ),
    },
    {
      id: "third-parties",
      title: "Third-party services and links",
      body: (
        <P>
          The Service may contain links to, or integrations with, services we do not control. Examples are
          Google sign-in, Stripe, WhatsApp, and links or embedded pages published by users. Their own terms and
          privacy policies apply. We are not responsible for their content or practices.
        </P>
      ),
    },
    {
      id: "availability",
      title: "Availability and security",
      body: (
        <P>
          We aim to keep the Service available and secure, but we do not guarantee uninterrupted or error-free
          operation. Maintenance, incidents or events beyond our reasonable control may cause interruptions.
          User-uploaded web content runs in sandboxed frames, but you should still only open content you trust.
          Keep your own copies of important content. You can export your data at any time from Settings.
        </P>
      ),
    },
    {
      id: "termination",
      title: "Suspension, termination and deletion",
      body: (
        <>
          <P>
            You can stop using the Service and delete your account at any time from Settings. Deleting your
            account:
          </P>
          <Ul>
            <li>cancels any active subscription immediately</li>
            <li>removes your page and content</li>
            <li>removes your personal data as described in the <A href="/privacy">Privacy Policy</A></li>
          </Ul>
          <P>
            Before deleting, you can download a copy of your data from Settings.
          </P>
          <P>
            We may suspend or terminate your account if:
          </P>
          <Ul>
            <li>you seriously or repeatedly breach these Terms</li>
            <li>the law requires us to</li>
            <li>continuing would expose us or others to serious harm</li>
          </Ul>
          <P>
            Unless the breach is serious or the law prevents it, we will warn you first and give you a
            reasonable chance to fix it. If we terminate a paid plan without cause, or for reasons that are not
            your fault, we refund any prepaid, unused period.
          </P>
          <P>
            We may also end the free plan, or discontinue the Service entirely, with at least 60 days&apos;
            notice. We will give you time to export your data.
          </P>
        </>
      ),
    },
    {
      id: "warranties",
      title: "Legal guarantees",
      body: (
        <>
          <P>
            <B>Consumers</B> benefit from the legal guarantee of conformity for digital content and services.
            For Italy, see Arts. 135-octies et seq. of the Consumer Code. Nothing in these Terms limits it.
          </P>
          <P>
            <B>Business users.</B> To the extent permitted by law, the Service is provided &quot;as is&quot; and
            &quot;as available&quot;. We give no implied warranties of merchantability, fitness for a particular
            purpose or non-infringement.
          </P>
        </>
      ),
    },
    {
      id: "liability",
      title: "Liability",
      body: (
        <>
          <P>
            Nothing in these Terms excludes or limits liability that cannot be limited by law. This includes
            liability for:
          </P>
          <Ul>
            <li>death or personal injury caused by negligence</li>
            <li>fraud</li>
            <li>wilful misconduct or gross negligence (Art. 1229 Italian Civil Code)</li>
            <li>a consumer&apos;s statutory rights</li>
          </Ul>
          <P>
            <B>Consumers.</B> We are liable for foreseeable loss caused by our breach of these Terms. We are not
            liable for:
          </P>
          <Ul>
            <li>loss that was not foreseeable</li>
            <li>loss caused by your own breach</li>
            <li>loss caused by events outside our reasonable control</li>
          </Ul>
          <P>
            <B>Business users.</B> Subject to the first paragraph, we are not liable for:
          </P>
          <Ul>
            <li>indirect or consequential loss</li>
            <li>loss of profits, revenue, bookings, goodwill or data</li>
          </Ul>
          <P>
            Our total liability to a business user in any 12-month period is limited to the greater of:
          </P>
          <Ul>
            <li>the amounts you paid us in that period</li>
            <li>EUR 100</li>
          </Ul>
          <P>
            We are not responsible for content published by users, or for the services businesses provide to
            their customers. Our hosting role under the DSA is described in section 9.
          </P>
        </>
      ),
    },
    {
      id: "indemnity",
      title: "Indemnity (business users)",
      body: (
        <>
          <P>
            If you are a business user, you will compensate us for third-party claims, fines and reasonable
            costs arising from:
          </P>
          <Ul>
            <li>Your Content</li>
            <li>your dealings with your customers</li>
            <li>your breach of these Terms, the DPA or the law</li>
          </Ul>
          <P>
            We will tell you promptly about any such claim and let you take part in handling it.
          </P>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes to these Terms",
      body: (
        <>
          <P>We may update these Terms for any of these reasons:</P>
          <Ul>
            <li>to reflect changes to the Service</li>
            <li>to reflect changes in the law</li>
            <li>for security reasons</li>
            <li>to improve clarity</li>
          </Ul>
          <P>
            For <B>material changes</B>, we notify you by email and in the app at least <B>30 days</B> before
            they take effect. You can then:
          </P>
          <Ul>
            <li>accept them, by clicking &quot;Accept&quot; or by continuing to use the Service after the effective date</li>
            <li>close your account before then, with a pro-rata refund of any prepaid, unused period</li>
          </Ul>
          <P>
            Changes required by law, or that only benefit you, may apply sooner. Previous versions are available
            on request.
          </P>
        </>
      ),
    },
    {
      id: "law",
      title: "Governing law and disputes",
      body: (
        <>
          <P>These Terms are governed by Italian law.</P>
          <P>
            <B>Consumers</B> keep the protection of the mandatory laws of the country where they live. They can
            bring proceedings in their own country&apos;s courts. If you live in Italy, the court of your place
            of residence or domicile has mandatory jurisdiction (Art. 66-bis Consumer Code).
          </P>
          <P>
            <B>Business users.</B> The courts of the place of our registered office have exclusive jurisdiction.
          </P>
          <P>
            Please contact us first at <Mail to={C.emails.support} />. Most issues are solved quickly that way.
            Consumers may also use an alternative dispute resolution (ADR) body. We will tell you whether we
            agree to take part in a specific procedure. Nothing here limits your right to go to court.
          </P>
        </>
      ),
    },
    {
      id: "general",
      title: "General",
      body: (
        <Ul>
          <li>
            If a provision is found invalid, the rest of these Terms stays in force. The invalid provision is
            replaced by the valid provision that comes closest to its purpose.
          </li>
          <li>
            You may not transfer your rights under these Terms without our consent. We may transfer our rights
            to a company that takes over the Service. If that happens, we will tell you, and you may close your
            account.
          </li>
          <li>
            If we do not enforce a right immediately, we have not waived it.
          </li>
          <li>
            These Terms are available in English and Italian. For consumers resident in Italy, the Italian
            version prevails.
          </li>
        </Ul>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <P>
          {C.legalName}, {C.registeredOffice}.
          <br />
          Support: <Mail to={C.emails.support} /> · Legal: <Mail to={C.emails.legal} /> · PEC: {C.pec}
        </P>
      ),
    },
  ],
};
