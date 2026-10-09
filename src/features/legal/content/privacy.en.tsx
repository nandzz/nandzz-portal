import { COMPANY as C, GARANTE_URL, MIN_AGE } from "../company";
import { A, B, H3, Mail, P, Summary, Table, Ul } from "../components/primitives";
import { SubprocessorTable } from "../components/SubprocessorTable";
import type { LegalDocument } from "../types";

export const privacyEn: LegalDocument = {
  title: "Privacy Policy",
  subtitle:
    "How Nandzz collects and uses personal data, and the rights you have. This covers account holders, visitors and people who book through a Nandzz page.",
  intro: (
    <Summary title="The short version">
      <Ul>
        <li>We collect only what we need to run Nandzz, take payments, keep the service secure and meet legal duties.</li>
        <li>We do not sell your data, show ads or use tracking cookies. Visitor statistics are cookieless and anonymised.</li>
        <li>
          If you book with a business through Nandzz, <B>that business is in charge of your data</B>. We process it on
          their behalf.
        </li>
        <li>
          You can access, correct, export and delete your data. You can also write to us at{" "}
          <Mail to={C.emails.privacy} />.
        </li>
      </Ul>
    </Summary>
  ),
  sections: [
    {
      id: "controller",
      title: "Who is responsible",
      body: (
        <>
          <P>
            The data controller is <B>{C.legalName}</B>, {C.registeredOffice}, VAT {C.vatNumber}. You can reach
            us at <Mail to={C.emails.privacy} /> or by PEC at {C.pec}.
          </P>
          <P>
            We have not appointed a Data Protection Officer, because the law does not require it for our
            activities. Your requests are handled directly by the team responsible for privacy.
          </P>
          <P>
            <B>Bookings and AI chats on a business&apos;s page.</B> Each business using Nandzz controls the
            personal data of its own customers. We act as that business&apos;s <B>processor</B> under Art. 28
            GDPR (see our <A href="/dpa">DPA</A>). This applies to:
          </P>
          <Ul>
            <li>bookings you make on a business&apos;s page</li>
            <li>messages you send to its AI agent</li>
          </Ul>
          <P>
            For requests about that data, contact the business directly. We will help them answer you.
            Section 4 explains this in more detail.
          </P>
        </>
      ),
    },
    {
      id: "what-we-collect",
      title: "What we collect, why, and on what legal basis",
      body: (
        <>
          <P>
            The table below lists each processing activity under the GDPR (Regulation (EU) 2016/679), with the
            data used, the legal basis under Art. 6 GDPR, and how long we keep it.
          </P>
          <Table
            head={["Activity", "Data", "Legal basis", "Retention"]}
            rows={[
              [
                <B key="a">Account and sign-in</B>,
                "Email, password (hashed), username, display name, Google account name, email and avatar if you use Google sign-in, phone number if you verify it",
                "Contract (Art. 6(1)(b))",
                "While your account exists. Deleted within 30 days of account deletion.",
              ],
              [
                <B key="a">Your public page and content</B>,
                "Profile details, bio, avatar, branding, business address, published content, links, gallery, comments, likes and follows",
                "Contract (Art. 6(1)(b))",
                "Until you delete it or your account",
              ],
              [
                <B key="a">Payments and invoicing</B>,
                "Name, email, billing address, plan, transactions, credit history. Card data stays with Stripe.",
                "Contract; legal obligation (tax and accounting, Art. 6(1)(c))",
                "10 years, as required by Italian accounting law (Art. 2220 Civil Code)",
              ],
              [
                <B key="a">Service emails and messages</B>,
                "Email or phone number, message content",
                "Contract; legitimate interest in security notices",
                "Delivery logs for 24 months",
              ],
              [
                <B key="a">Cookieless visitor statistics</B>,
                "A one-way hash of IP address, browser user-agent and date, which rotates every day. Raw IP addresses are never stored. If you are signed in, your user ID is used instead.",
                "Legitimate interest (Art. 6(1)(f)): showing page owners how many people visit",
                "13 months",
              ],
              [
                <B key="a">Security and abuse prevention</B>,
                "IP address, request and authentication logs, rate-limit counters",
                "Legitimate interest: keeping the service secure",
                "Up to 90 days, unless needed for an investigation",
              ],
              [
                <B key="a">AI features you use</B>,
                "Instructions and content you submit to the AI editor",
                "Contract",
                "Not stored by us beyond the job result. The provider keeps it for up to 30 days for abuse monitoring.",
              ],
              [
                <B key="a">Support and contact form</B>,
                "Name, email, your message",
                "Legitimate interest in answering you; contract where it relates to your account",
                "Up to 24 months after the conversation ends",
              ],
              [
                <B key="a">Content reports (DSA)</B>,
                "URL reported, reason, your name and email if given",
                "Legal obligation (DSA Art. 16)",
                "24 months",
              ],
              [
                <B key="a">Terms acceptance records</B>,
                "Version accepted and timestamp",
                "Legal obligation and legitimate interest in proving consent and acceptance",
                "While your account exists",
              ],
            ]}
          />
          <P>
            We do not use your data for advertising, profiling or automated decisions with legal or similarly
            significant effects (Art. 22 GDPR). We do not use your content or your customers&apos; data to train
            AI models.
          </P>
          <P>
            Providing account and payment data is necessary to use those features. Everything else is optional.
          </P>
        </>
      ),
    },
    {
      id: "legitimate-interests",
      title: "Your right to object to legitimate interests",
      body: (
        <P>
          Where we rely on legitimate interests, we have balanced them against your rights. We keep the data
          minimal, for example by hashing visitor data daily. You can object at any time by writing to{" "}
          <Mail to={C.emails.privacy} />. We will stop unless we have compelling legitimate grounds, or need the
          data for legal claims.
        </P>
      ),
    },
    {
      id: "bookings",
      title: "If you book through a Nandzz page",
      body: (
        <>
          <P>
            When you book an appointment or chat with an AI agent on a business&apos;s Nandzz page, the
            business collects the following data, and its own staff can see it:
          </P>
          <Ul>
            <li>your name and phone number</li>
            <li>your email, if you give it</li>
            <li>your address, if the business asks for it</li>
            <li>your notes</li>
            <li>the appointment details</li>
            <li>your chat messages</li>
          </Ul>
          <P>
            <B>The business is the controller</B>, and Nandzz processes the data on its behalf. Its own privacy
            notice applies. Ask the business directly if you want to exercise your rights.
          </P>
          <P>On the business&apos;s behalf, we:</P>
          <Ul>
            <li>store your booking</li>
            <li>send confirmation, change and reminder emails</li>
            <li>
              send a WhatsApp reminder via Twilio, <B>only if you tick the box</B>. To stop reminders later, ask the
              business.
            </li>
            <li>generate AI chat answers via OpenAI. Chat messages are not kept by us after the answer is sent.</li>
          </Ul>
          <P>
            Booking customer details are anonymised automatically 24 months after the appointment, or earlier if
            the business deletes them or closes its account.
          </P>
          <P>
            If you are signed in to your own Nandzz account when you book, we also link the booking to your
            account so you can manage it. For that link we are the controller, and the legal basis is contract.
          </P>
        </>
      ),
    },
    {
      id: "sharing",
      title: "Who we share data with",
      body: (
        <>
          <P>We do not sell or rent personal data. We share it only with:</P>
          <Ul>
            <li>
              <B>Service providers (processors)</B> that help us run Nandzz, under contracts that bind them to
              our instructions. They are listed below.
            </li>
            <li>
              <B>Businesses you book with</B>, which receive the booking data you enter.
            </li>
            <li>
              <B>The public</B>, for content you choose to publish on your page.
            </li>
            <li>
              <B>Authorities</B>, when the law requires it, or to protect rights and safety.
            </li>
            <li>
              <B>A buyer or successor</B>, if Nandzz is merged or sold. They will be bound by this policy, and we
              will tell you first.
            </li>
          </Ul>
          <H3>Sub-processors</H3>
          <SubprocessorTable locale="en" />
        </>
      ),
    },
    {
      id: "transfers",
      title: "International transfers",
      body: (
        <>
          <P>
            Our main database is hosted in the EU. Some providers in the table above are based in the United
            States or may access data from there. When data leaves the EU/EEA, we rely on safeguards:
          </P>
          <Ul>
            <li>
              the EU–US Data Privacy Framework, for certified recipients (Art. 45 GDPR adequacy decision)
            </li>
            <li>
              the European Commission&apos;s Standard Contractual Clauses (Art. 46 GDPR), with additional
              measures where needed
            </li>
          </Ul>
          <P>
            You can ask us for a copy of these safeguards.
          </P>
        </>
      ),
    },
    {
      id: "security",
      title: "Security",
      body: (
        <>
          <P>We protect data with:</P>
          <Ul>
            <li>encryption in transit (TLS) and at rest</li>
            <li>row-level access controls in the database</li>
            <li>least-privilege access for staff</li>
            <li>hashed passwords</li>
            <li>isolated (sandboxed) rendering of user-uploaded web content</li>
          </Ul>
          <P>
            No system is perfectly secure. If a breach is likely to put you at risk, we will notify you and the
            competent authority as the law requires.
          </P>
        </>
      ),
    },
    {
      id: "rights",
      title: "Your rights",
      body: (
        <>
          <P>Under the GDPR you have the right to:</P>
          <Ul>
            <li><B>access</B> your data and receive a copy</li>
            <li><B>rectify</B> inaccurate data. Most of it you can edit yourself in Settings.</li>
            <li><B>erase</B> your data. Delete your account in Settings, or ask us.</li>
            <li><B>restrict</B> processing in certain cases</li>
            <li>
              <B>data portability</B>. Use &quot;Download my data&quot; in Settings to get a machine-readable
              JSON file.
            </li>
            <li><B>object</B> to processing based on legitimate interests (section 3)</li>
            <li><B>withdraw consent</B> at any time, without affecting earlier processing</li>
          </Ul>
          <P>
            Write to <Mail to={C.emails.privacy} />. We answer within one month. In complex cases this can be
            extended by two more months, and we will tell you if so. We may ask you to confirm your identity.
          </P>
          <P>
            You also have the right to complain to a supervisory authority. In Italy that is the{" "}
            <A href={GARANTE_URL}>Garante per la protezione dei dati personali</A>. You can also complain to the
            authority where you live or work.
          </P>
        </>
      ),
    },
    {
      id: "children",
      title: "Children",
      body: (
        <P>
          Nandzz is not intended for children under {MIN_AGE}, and they may not create an account. If you
          believe a child under {MIN_AGE} has given us personal data, contact us and we will delete it.
        </P>
      ),
    },
    {
      id: "cookies",
      title: "Cookies",
      body: (
        <P>
          We use only technically necessary cookies and similar storage, so no consent banner is needed. See the{" "}
          <A href="/cookies">Cookie Policy</A> for the full list.
        </P>
      ),
    },
    {
      id: "us-uk",
      title: "Additional information for the UK and the United States",
      body: (
        <>
          <P>
            <B>United Kingdom.</B> The UK GDPR gives you the same rights. You can complain to the Information
            Commissioner&apos;s Office (ico.org.uk). Transfers from the UK use the UK Addendum to the Standard
            Contractual Clauses, or the UK–US data bridge.
          </P>
          <P>
            <B>California and other US states.</B> In the last 12 months we collected the categories described
            in section 2:
          </P>
          <Ul>
            <li>identifiers</li>
            <li>commercial information</li>
            <li>internet activity</li>
            <li>user content</li>
          </Ul>
          <P>
            We used them for the business purposes described above. We do <B>not sell</B> personal information.
            We do not <B>share</B> it for cross-context behavioural advertising. We do not use sensitive personal
            information to infer characteristics.
          </P>
          <P>
            You may request to know, correct or delete your personal information through the contacts above. We
            will not discriminate against you for exercising these rights. An authorised agent can make a
            request on your behalf, with proof of authorisation.
          </P>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: (
        <P>
          We update this policy when our processing changes. For significant changes, we will notify you in the
          app or by email before they apply. The date at the top shows the current version.
        </P>
      ),
    },
  ],
};
