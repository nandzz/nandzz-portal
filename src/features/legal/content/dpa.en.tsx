import { COMPANY as C } from "../company";
import { A, B, H3, Mail, P, Ul } from "../components/primitives";
import { SubprocessorTable } from "../components/SubprocessorTable";
import type { LegalDocument } from "../types";

export const dpaEn: LegalDocument = {
  title: "Data Processing Agreement",
  subtitle:
    "Art. 28 GDPR terms for businesses that use Nandzz to process their customers' personal data. Part of the Terms of Service. No signature needed.",
  sections: [
    {
      id: "parties",
      title: "Parties and scope",
      body: (
        <>
          <P>
            This Data Processing Agreement (&quot;<B>DPA</B>&quot;) is between:
          </P>
          <Ul>
            <li>
              the business account holder (&quot;<B>Controller</B>&quot;, &quot;<B>you</B>&quot;)
            </li>
            <li>
              {C.legalName} (&quot;<B>Processor</B>&quot;, &quot;<B>Nandzz</B>&quot;)
            </li>
          </Ul>
          <P>
            It applies whenever Nandzz processes personal data on your behalf when it provides the Service, in
            particular data of your customers and visitors (&quot;<B>Customer Data</B>&quot;). It forms part of
            the <A href="/terms">Terms of Service</A> and takes effect when you accept them. If this DPA and the
            Terms conflict on data protection, this DPA prevails.
          </P>
        </>
      ),
    },
    {
      id: "details",
      title: "Details of the processing",
      body: (
        <Ul>
          <li>
            <B>Subject matter and duration:</B> providing the booking, AI agent, messaging and page features of
            the Service, for as long as you use them.
          </li>
          <li>
            <B>Nature and purpose:</B>
            <Ul>
              <li>collecting and storing bookings</li>
              <li>showing bookings to you and your staff</li>
              <li>sending confirmations and reminders by email and, with the customer&apos;s opt-in, WhatsApp</li>
              <li>answering visitor questions with your AI agent</li>
              <li>hosting and support</li>
            </Ul>
          </li>
          <li>
            <B>Data subjects:</B> your customers, prospective customers, website visitors and staff members you
            add.
          </li>
          <li>
            <B>Categories of data:</B>
            <Ul>
              <li>name, phone number, email</li>
              <li>address, if you enable that field</li>
              <li>notes</li>
              <li>appointment details</li>
              <li>chat messages</li>
              <li>staff names and schedules</li>
            </Ul>
          </li>
          <li>
            <B>Special categories:</B> none are intended. You must not configure the Service to collect them,
            for example health data in booking notes, unless you have a lawful basis and have assessed the risk.
          </li>
        </Ul>
      ),
    },
    {
      id: "instructions",
      title: "Processing on documented instructions",
      body: (
        <P>
          Nandzz processes Customer Data only on your documented instructions. These instructions are the Terms,
          this DPA, and your configuration and use of the Service. The only exception is where EU or Member
          State law requires otherwise, in which case we will inform you unless that law prohibits it. We will
          tell you if we believe an instruction infringes data-protection law. We do not sell Customer Data, and
          we do not use it for our own purposes or to train AI models.
        </P>
      ),
    },
    {
      id: "confidentiality",
      title: "Confidentiality",
      body: (
        <P>
          Anyone at Nandzz authorised to process Customer Data is bound by confidentiality. Access is limited to
          what is needed to provide and support the Service.
        </P>
      ),
    },
    {
      id: "security",
      title: "Security measures",
      body: (
        <>
          <P>We implement the technical and organisational measures in Annex 1 (Art. 32 GDPR).</P>
          <P>
            We may update these measures, but never in a way that lowers the overall level of protection.
          </P>
        </>
      ),
    },
    {
      id: "subprocessors",
      title: "Sub-processors",
      body: (
        <>
          <P>
            You give us general authorisation to engage sub-processors. The current list is in Annex 2 and in
            our <A href="/privacy#sharing">Privacy Policy</A>. We will notify you of any intended addition or
            replacement at least <B>30 days</B> in advance, by email or in the dashboard. You may object on
            reasonable data-protection grounds. If we cannot resolve the objection, you may terminate the
            affected service and receive a refund of any prepaid, unused period.
          </P>
          <P>
            Each sub-processor is bound by data-protection obligations equivalent to this DPA. We remain liable
            for their performance.
          </P>
        </>
      ),
    },
    {
      id: "assistance",
      title: "Assistance to the Controller",
      body: (
        <>
          <P>
            Taking into account the nature of the processing, we will help you:
          </P>
          <Ul>
            <li>
              respond to data-subject requests (Arts. 15–22 GDPR). The dashboard lets you view, edit, cancel and
              delete bookings. If a request reaches us directly, we forward it to you without undue delay and do
              not answer it ourselves.
            </li>
            <li>
              with security, breach notification, data-protection impact assessments and prior consultation
              (Arts. 32–36 GDPR)
            </li>
          </Ul>
        </>
      ),
    },
    {
      id: "breach",
      title: "Personal data breaches",
      body: (
        <P>
          We will notify you without undue delay, and in any case within <B>48 hours</B>, after becoming aware
          of a personal data breach affecting Customer Data. The notice will include the information available
          to us that you need for your own notifications under Arts. 33–34 GDPR, and we will update it as we
          learn more.
        </P>
      ),
    },
    {
      id: "deletion",
      title: "Retention, return and deletion",
      body: (
        <>
          <P>
            You can delete bookings at any time. By default, customer details in bookings are{" "}
            <B>anonymised 24 months</B> after the appointment. When you close your account, we delete Customer
            Data within 30 days, and backups are overwritten within a further 30 days. The only exception is data
            we must keep by law.
          </P>
          <P>
            Before closing your account, you can export your data from Settings.
          </P>
        </>
      ),
    },
    {
      id: "audits",
      title: "Information and audits",
      body: (
        <P>
          We will make available the information needed to demonstrate compliance with Art. 28 GDPR. This
          includes this DPA, our security measures and our sub-processors&apos; certifications. Where that is
          not enough, we will allow audits by you or an independent auditor bound by confidentiality, on 30
          days&apos; notice, at your cost, no more than once a year, unless a breach or an authority requires
          otherwise.
        </P>
      ),
    },
    {
      id: "transfers",
      title: "International transfers",
      body: (
        <P>
          Customer Data is stored in the EU. Where a sub-processor processes it outside the EU/EEA, we ensure an
          adequate safeguard under Chapter V GDPR. This is an adequacy decision (including the EU–US Data
          Privacy Framework) or the Standard Contractual Clauses (Module 3, processor-to-processor), which we
          have entered into with the relevant sub-processor.
        </P>
      ),
    },
    {
      id: "controller-duties",
      title: "Your responsibilities",
      body: (
        <>
          <P>You are responsible for:</P>
          <Ul>
            <li>the lawfulness of the processing you instruct, including having a legal basis</li>
            <li>providing privacy information to your customers</li>
            <li>obtaining consent where required, for example for marketing messages</li>
            <li>the accuracy of the data you enter</li>
          </Ul>
        </>
      ),
    },
    {
      id: "liability",
      title: "Liability and term",
      body: (
        <P>
          Liability under this DPA follows the Terms, without limiting either party&apos;s liability to data
          subjects under Art. 82 GDPR. This DPA lasts as long as we process Customer Data for you. Contact:{" "}
          <Mail to={C.emails.privacy} />.
        </P>
      ),
    },
    {
      id: "annex-1",
      title: "Annex 1: Technical and organisational measures",
      body: (
        <Ul>
          <li>Encryption in transit (TLS 1.2+) and at rest for databases, storage and backups</li>
          <li>Database row-level security, so each business can only access its own records</li>
          <li>Service-role keys kept server-side only</li>
          <li>Least-privilege staff access, with multi-factor authentication on admin and provider consoles</li>
          <li>Hashed passwords, and OAuth sign-in support</li>
          <li>Rate limiting and abuse detection on public endpoints</li>
          <li>Sandboxed rendering of user-uploaded web content, isolated from the application origin</li>
          <li>Automated backups with point-in-time recovery from our database provider</li>
          <li>Data minimisation: optional fields are off by default, visitor statistics are hashed daily, and automatic retention sweeps run</li>
          <li>Incident response procedure and logging of administrative actions</li>
        </Ul>
      ),
    },
    {
      id: "annex-2",
      title: "Annex 2: Authorised sub-processors",
      body: (
        <>
          <H3>Sub-processors that may process Customer Data</H3>
          <SubprocessorTable locale="en" bookingOnly />
        </>
      ),
    },
  ],
};
