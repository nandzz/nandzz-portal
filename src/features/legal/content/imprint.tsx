import { COMPANY as C } from "../company";
import { A, Mail, P, Table } from "../components/primitives";
import type { LegalLocale } from "../locale";
import type { LegalDocument } from "../types";

// Legal notice / Note legali — company identification required for websites
// of Italian companies (art. 2250 c.c., art. 35 DPR 633/72) and for
// information-society services (art. 7 D.Lgs. 70/2003).
function details(locale: LegalLocale) {
  const it = locale === "it";
  return (
    <Table
      head={[it ? "Voce" : "Item", it ? "Dato" : "Detail"]}
      rows={[
        [it ? "Ragione sociale" : "Company name", C.legalName],
        [it ? "Sede legale" : "Registered office", C.registeredOffice],
        [it ? "Partita IVA / Codice fiscale" : "VAT number / Tax code", C.vatNumber],
        [it ? "Iscrizione REA" : "Companies register (REA)", C.reaNumber],
        [it ? "Capitale sociale" : "Share capital", C.shareCapital],
        ["PEC", C.pec],
        [it ? "Assistenza" : "Support", <Mail key="s" to={C.emails.support} />],
        [it ? "Privacy" : "Privacy", <Mail key="p" to={C.emails.privacy} />],
        [
          it ? "Punto di contatto DSA" : "DSA point of contact",
          <Mail key="d" to={C.emails.dsa} />,
        ],
      ]}
    />
  );
}

export const imprintEn: LegalDocument = {
  title: "Legal notice",
  subtitle: "Who operates nandzz.com.",
  sections: [
    { id: "company", title: "Company details", body: details("en") },
    {
      id: "documents",
      title: "Legal documents",
      body: (
        <P>
          <A href="/terms">Terms of Service</A> · <A href="/privacy">Privacy Policy</A> ·{" "}
          <A href="/cookies">Cookie Policy</A> · <A href="/acceptable-use">Acceptable Use Policy</A> ·{" "}
          <A href="/dpa">Data Processing Agreement</A> · <A href="/report">Report content</A>
        </P>
      ),
    },
    {
      id: "disputes",
      title: "Consumer disputes",
      body: (
        <P>
          Consumers can contact us first at <Mail to={C.emails.support} />. They may also turn to an
          alternative dispute resolution body. For disputes about content moderation decisions, they may turn to
          a certified out-of-court dispute settlement body under Art. 21 of the Digital Services Act.
        </P>
      ),
    },
  ],
};

export const imprintIt: LegalDocument = {
  title: "Note legali",
  subtitle: "Chi gestisce nandzz.com.",
  sections: [
    { id: "company", title: "Dati societari", body: details("it") },
    {
      id: "documents",
      title: "Documenti legali",
      body: (
        <P>
          <A href="/terms">Termini di Servizio</A> · <A href="/privacy">Informativa privacy</A> ·{" "}
          <A href="/cookies">Cookie policy</A> · <A href="/acceptable-use">Policy di uso accettabile</A> ·{" "}
          <A href="/dpa">Accordo sul trattamento dei dati</A> · <A href="/report">Segnala contenuti</A>
        </P>
      ),
    },
    {
      id: "disputes",
      title: "Controversie con i consumatori",
      body: (
        <P>
          I consumatori possono contattarci prima a <Mail to={C.emails.support} />. Possono anche rivolgersi a un
          organismo di risoluzione alternativa delle controversie. Per le controversie sulle decisioni di
          moderazione dei contenuti, possono rivolgersi a un organismo certificato di risoluzione extragiudiziale
          ai sensi dell&apos;art. 21 del Digital Services Act.
        </P>
      ),
    },
  ],
};
