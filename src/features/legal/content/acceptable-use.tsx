import { A, B, P, Ul } from "../components/primitives";
import type { LegalDocument } from "../types";

export const acceptableUseEn: LegalDocument = {
  title: "Acceptable Use Policy",
  subtitle:
    "What you may not do on Nandzz. This policy is part of the Terms of Service and applies to all content, bookings, messages and AI features.",
  sections: [
    {
      id: "illegal",
      title: "Illegal and harmful content",
      body: (
        <>
          <P>Do not publish, upload or share content that:</P>
          <Ul>
            <li>is illegal in the EU or in the country where it is made available</li>
            <li>
              sexually exploits or endangers minors. We report child sexual abuse material to the competent
              authorities.
            </li>
            <li>promotes terrorism, incites violence, or threatens anyone</li>
            <li>
              is hate speech, or harasses or discriminates against people based on a protected characteristic
            </li>
            <li>shares someone&apos;s private information or intimate images without consent</li>
            <li>sells or promotes illegal goods or services, weapons, drugs or counterfeit products</li>
            <li>contains sexually explicit material</li>
          </Ul>
        </>
      ),
    },
    {
      id: "deception",
      title: "Fraud, deception and impersonation",
      body: (
        <Ul>
          <li>No phishing, scams, pyramid schemes, or fake offers, bookings or reviews.</li>
          <li>Do not impersonate a person, business or brand, or falsely suggest you are affiliated with one.</li>
          <li>Do not publish misleading information about your services, prices or availability.</li>
          <li>Do not create accounts in bulk or by automated means, or to evade a suspension.</li>
        </Ul>
      ),
    },
    {
      id: "ip",
      title: "Intellectual property",
      body: (
        <P>
          Only publish content you own or have permission to use. Do not infringe copyright, trademarks or other
          rights. Rights holders can use the <A href="/report">reporting form</A>.
        </P>
      ),
    },
    {
      id: "security",
      title: "Security and technical abuse",
      body: (
        <Ul>
          <li>No malware, spyware, cryptominers, exploit code, or content designed to harm visitors&apos; devices.</li>
          <li>Do not try to bypass the sandbox, access controls, rate limits or billing.</li>
          <li>Do not probe, scan or test the Service&apos;s vulnerabilities without our written permission. You can report security issues to us.</li>
          <li>Do not scrape the Service, or overload it with automated traffic.</li>
        </Ul>
      ),
    },
    {
      id: "messaging",
      title: "Bookings and messaging",
      body: (
        <Ul>
          <li>Do not create fake bookings, or use booking or reminder features to spam people.</li>
          <li>Do not message customers for marketing without their prior consent where the law requires it.</li>
          <li>Do not collect special-category data, such as health data, through booking fields unless you have a lawful basis.</li>
        </Ul>
      ),
    },
    {
      id: "ai",
      title: "AI features",
      body: (
        <Ul>
          <li>Do not use AI features to produce illegal, deceptive or harmful content, including deepfakes of real people.</li>
          <li>Do not hide the fact that visitors are talking to an AI.</li>
          <li>Do not use the AI agent for decisions with legal or similarly significant effects on people.</li>
          <li>Do not attempt to extract our AI providers&apos; systems or bypass their safety measures.</li>
        </Ul>
      ),
    },
    {
      id: "enforcement",
      title: "Enforcement",
      body: (
        <P>
          If you break this policy, we may remove content, limit features, or suspend or close your account, as
          described in the <A href="/terms#moderation">Terms</A>. We will tell you why and how to appeal. Report
          violations through the <A href="/report">reporting form</A>. <B>In an emergency, contact the
          police.</B>
        </P>
      ),
    },
  ],
};

export const acceptableUseIt: LegalDocument = {
  title: "Policy di uso accettabile",
  subtitle:
    "Cosa non puoi fare su Nandzz. Questa policy fa parte dei Termini di Servizio e si applica a tutti i contenuti, prenotazioni, messaggi e funzioni di IA.",
  sections: [
    {
      id: "illegal",
      title: "Contenuti illeciti e dannosi",
      body: (
        <>
          <P>Non pubblicare, caricare o condividere contenuti che:</P>
          <Ul>
            <li>sono illeciti nell&apos;UE o nel paese in cui sono resi disponibili</li>
            <li>
              sfruttano sessualmente o mettono in pericolo minori. Segnaliamo il materiale pedopornografico alle
              autorità competenti.
            </li>
            <li>promuovono il terrorismo, incitano alla violenza o minacciano qualcuno</li>
            <li>
              incitano all&apos;odio, o molestano o discriminano persone per una caratteristica protetta
            </li>
            <li>diffondono informazioni private o immagini intime di altri senza consenso</li>
            <li>vendono o promuovono beni o servizi illegali, armi, droghe o prodotti contraffatti</li>
            <li>contengono materiale sessualmente esplicito</li>
          </Ul>
        </>
      ),
    },
    {
      id: "deception",
      title: "Frodi, inganni e furti d'identità",
      body: (
        <Ul>
          <li>Niente phishing, truffe, schemi piramidali, né offerte, prenotazioni o recensioni false.</li>
          <li>Non impersonare persone, attività o marchi, e non far credere di esservi affiliato.</li>
          <li>Non pubblicare informazioni ingannevoli su servizi, prezzi o disponibilità.</li>
          <li>Non creare account in massa o con mezzi automatizzati, né per eludere una sospensione.</li>
        </Ul>
      ),
    },
    {
      id: "ip",
      title: "Proprietà intellettuale",
      body: (
        <P>
          Pubblica solo contenuti di cui sei titolare o che hai il permesso di usare. Non violare diritti
          d&apos;autore, marchi o altri diritti. I titolari dei diritti possono usare il{" "}
          <A href="/report">modulo di segnalazione</A>.
        </P>
      ),
    },
    {
      id: "security",
      title: "Sicurezza e abusi tecnici",
      body: (
        <Ul>
          <li>Niente malware, spyware, cryptominer, codice di exploit o contenuti pensati per danneggiare i dispositivi dei visitatori.</li>
          <li>Non tentare di aggirare la sandbox, i controlli di accesso, i limiti di frequenza o la fatturazione.</li>
          <li>Non sondare, scansionare o testare le vulnerabilità del Servizio senza nostro permesso scritto. Puoi segnalarci problemi di sicurezza.</li>
          <li>Non fare scraping del Servizio e non sovraccaricarlo con traffico automatizzato.</li>
        </Ul>
      ),
    },
    {
      id: "messaging",
      title: "Prenotazioni e messaggi",
      body: (
        <Ul>
          <li>Non creare prenotazioni false e non usare prenotazioni o promemoria per inviare spam.</li>
          <li>Non inviare messaggi promozionali ai clienti senza il loro consenso preventivo, ove richiesto dalla legge.</li>
          <li>Non raccogliere categorie particolari di dati, come i dati sanitari, nei campi di prenotazione senza una base giuridica.</li>
        </Ul>
      ),
    },
    {
      id: "ai",
      title: "Funzioni di IA",
      body: (
        <Ul>
          <li>Non usare l&apos;IA per produrre contenuti illeciti, ingannevoli o dannosi, compresi i deepfake di persone reali.</li>
          <li>Non nascondere ai visitatori che stanno parlando con un&apos;IA.</li>
          <li>Non usare l&apos;agente IA per decisioni che producono effetti giuridici o altrettanto significativi sulle persone.</li>
          <li>Non tentare di estrarre i sistemi dei nostri fornitori di IA né di aggirarne le misure di sicurezza.</li>
        </Ul>
      ),
    },
    {
      id: "enforcement",
      title: "Provvedimenti",
      body: (
        <P>
          Se violi questa policy, possiamo rimuovere contenuti, limitare funzioni, o sospendere o chiudere
          l&apos;account, come descritto nei <A href="/terms#moderation">Termini</A>. Ti spiegheremo il motivo e
          come presentare reclamo. Segnala le violazioni con il <A href="/report">modulo di segnalazione</A>.{" "}
          <B>In caso di emergenza contatta le forze dell&apos;ordine.</B>
        </P>
      ),
    },
  ],
};
