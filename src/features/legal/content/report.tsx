import { COMPANY as C } from "../company";
import { A, B, Mail, P, Ul } from "../components/primitives";
import type { LegalDocument } from "../types";

export const reportEn: LegalDocument = {
  title: "Report content",
  subtitle:
    "Tell us about content on Nandzz that you believe is illegal or breaks our policies (notice and action under Art. 16 of the Digital Services Act).",
  sections: [
    {
      id: "how",
      title: "How it works",
      body: (
        <>
          <Ul>
            <li>Give us the exact URL, the reason, and a clear explanation. You don&apos;t need an account.</li>
            <li>
              Your name and email are optional. If you leave your email, we confirm receipt and tell you our
              decision. You can report child sexual abuse material anonymously.
            </li>
            <li>
              We review every notice diligently, objectively and without undue delay. If we restrict the
              content, we notify the uploader with a statement of reasons, unless the law prevents it.
            </li>
            <li>
              Unfounded or abusive notices may lead to restrictions. See the{" "}
              <A href="/terms#moderation">Terms</A>.
            </li>
          </Ul>
          <P>
            <B>In an emergency or if someone is in danger, contact the police first.</B>
          </P>
        </>
      ),
    },
    {
      id: "contact",
      title: "Single point of contact",
      body: (
        <P>
          Authorities, trusted flaggers and users can also write to our DSA single point of contact at{" "}
          <Mail to={C.emails.dsa} />, in English or Italian. Copyright holders in the US can also send DMCA
          notices to <Mail to={C.emails.legal} />.
        </P>
      ),
    },
  ],
};

export const reportIt: LegalDocument = {
  title: "Segnala contenuti",
  subtitle:
    "Segnalaci contenuti su Nandzz che ritieni illeciti o in violazione delle nostre policy (meccanismo di segnalazione e azione, art. 16 del Digital Services Act).",
  sections: [
    {
      id: "how",
      title: "Come funziona",
      body: (
        <>
          <Ul>
            <li>Indica l&apos;URL esatto, il motivo e una spiegazione chiara. Non serve un account.</li>
            <li>
              Nome ed email sono facoltativi. Se lasci l&apos;email, confermiamo la ricezione e ti comunichiamo
              la decisione. Puoi segnalare in forma anonima il materiale pedopornografico.
            </li>
            <li>
              Esaminiamo ogni segnalazione con diligenza, obiettività e senza ritardi ingiustificati. Se
              limitiamo il contenuto, informiamo chi lo ha caricato con una motivazione, salvo divieti di legge.
            </li>
            <li>
              Le segnalazioni infondate o abusive possono portare a restrizioni. Vedi i{" "}
              <A href="/terms#moderation">Termini</A>.
            </li>
          </Ul>
          <P>
            <B>In caso di emergenza o se qualcuno è in pericolo, contatta prima le forze dell&apos;ordine.</B>
          </P>
        </>
      ),
    },
    {
      id: "contact",
      title: "Punto di contatto unico",
      body: (
        <P>
          Autorità, segnalatori attendibili e utenti possono scrivere anche al nostro punto di contatto unico DSA,{" "}
          <Mail to={C.emails.dsa} />, in italiano o in inglese. I titolari di diritti d&apos;autore negli USA
          possono inviare notifiche DMCA anche a <Mail to={C.emails.legal} />.
        </P>
      ),
    },
  ],
};
