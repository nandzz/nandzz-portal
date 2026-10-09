import { COMPANY as C, GARANTE_URL } from "../company";
import { A, B, Mail, P, Table, Ul } from "../components/primitives";
import type { LegalLocale } from "../locale";
import type { LegalDocument } from "../types";

// Inventory of every cookie / browser-storage key the app sets. Keep in sync
// with src/proxy.ts, LanguageContext, AppChrome, WidgetWorkspace,
// CalendarBookingFlow and next-themes.
type Item = {
  name: string;
  type: Record<LegalLocale, string>;
  purpose: Record<LegalLocale, string>;
  duration: Record<LegalLocale, string>;
};

const COOKIE = { en: "Cookie (first-party)", it: "Cookie (prima parte)" };
const LOCAL = { en: "Local storage", it: "Local storage" };
const SESSION = { en: "Session storage", it: "Session storage" };

const ITEMS: Item[] = [
  {
    name: "sb-<project>-auth-token*",
    type: COOKIE,
    purpose: {
      en: "Keeps you signed in and secures your session (set by our authentication provider, Supabase, on our domain)",
      it: "Mantiene l'accesso e protegge la sessione (impostato dal nostro fornitore di autenticazione, Supabase, sul nostro dominio)",
    },
    duration: { en: "Session / up to 1 year while signed in", it: "Sessione / fino a 1 anno finché resti connesso" },
  },
  {
    name: "nandzz-lang",
    type: COOKIE,
    purpose: { en: "Remembers your language", it: "Ricorda la lingua scelta" },
    duration: { en: "1 year", it: "1 anno" },
  },
  {
    name: "nandzz-profile-uid",
    type: COOKIE,
    purpose: {
      en: "Technical cache that your profile exists, so pages load without an extra lookup (HttpOnly)",
      it: "Cache tecnica che indica l'esistenza del tuo profilo, per caricare le pagine senza una verifica in più (HttpOnly)",
    },
    duration: { en: "30 days", it: "30 giorni" },
  },
  {
    name: "theme",
    type: LOCAL,
    purpose: { en: "Remembers light/dark mode", it: "Ricorda il tema chiaro/scuro" },
    duration: { en: "Until cleared", it: "Fino alla cancellazione" },
  },
  {
    name: "sidebar:collapsed",
    type: LOCAL,
    purpose: { en: "Remembers whether the sidebar is collapsed", it: "Ricorda se la barra laterale è chiusa" },
    duration: { en: "Until cleared", it: "Fino alla cancellazione" },
  },
  {
    name: "widget:<id>:locationId",
    type: LOCAL,
    purpose: {
      en: "Remembers the location selected in your booking dashboard",
      it: "Ricorda la sede selezionata nella dashboard prenotazioni",
    },
    duration: { en: "Until cleared", it: "Fino alla cancellazione" },
  },
  {
    name: "nandzz.auth.returnTo, booking snapshot",
    type: SESSION,
    purpose: {
      en: "Brings you back to your booking after signing in",
      it: "Ti riporta alla prenotazione dopo l'accesso",
    },
    duration: { en: "Until the tab is closed", it: "Fino alla chiusura della scheda" },
  },
];

function inventory(locale: LegalLocale) {
  const head =
    locale === "it" ? ["Nome", "Tipo", "Finalità", "Durata"] : ["Name", "Type", "Purpose", "Duration"];
  return (
    <Table
      head={head}
      rows={ITEMS.map((i) => [
        <code key="n" className="text-xs text-foreground">
          {i.name}
        </code>,
        i.type[locale],
        i.purpose[locale],
        i.duration[locale],
      ])}
    />
  );
}

export const cookiesEn: LegalDocument = {
  title: "Cookie Policy",
  subtitle: "Which cookies and similar technologies Nandzz uses, and why no consent banner is needed.",
  sections: [
    {
      id: "summary",
      title: "Summary",
      body: (
        <P>
          Nandzz uses only <B>technically necessary</B> cookies and browser storage. We use them to sign you in,
          keep the service secure and remember your settings. We use <B>no</B> advertising, profiling or
          third-party analytics cookies. Our visitor statistics are cookieless. Under Art. 122 of the Italian
          Privacy Code and the Garante&apos;s cookie guidelines (10 June 2021), technical cookies do not need
          consent, so we don&apos;t show a cookie banner.
        </P>
      ),
    },
    {
      id: "inventory",
      title: "What we use",
      body: inventory("en"),
    },
    {
      id: "third-parties",
      title: "Third-party content",
      body: (
        <>
          <P>
            We do not load third-party trackers. A few features connect to other services only when you use
            them:
          </P>
          <Ul>
            <li>
              <B>Google sign-in</B> runs on Google&apos;s pages under Google&apos;s policies.
            </li>
            <li>
              <B>Address autocomplete</B> sends the text you type to Google Places, only while you type an
              address.
            </li>
            <li>
              <B>Stripe Checkout</B> runs on Stripe&apos;s pages, where Stripe sets its own fraud-prevention
              cookies.
            </li>
            <li>
              Pages and embeds published by users run in sandboxed frames. Their authors are responsible for
              them, and those frames cannot read Nandzz cookies.
            </li>
          </Ul>
        </>
      ),
    },
    {
      id: "manage",
      title: "Managing cookies",
      body: (
        <P>
          You can delete or block cookies in your browser settings. If you block the authentication cookies, you
          will not be able to sign in. If we ever introduce non-essential cookies, we will ask for your consent
          first and let you change your choice at any time. More information is available from the{" "}
          <A href={GARANTE_URL}>Garante</A>.
        </P>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <P>
          Questions: <Mail to={C.emails.privacy} />. See also our <A href="/privacy">Privacy Policy</A>.
        </P>
      ),
    },
  ],
};

export const cookiesIt: LegalDocument = {
  title: "Cookie policy",
  subtitle: "Quali cookie e tecnologie simili usa Nandzz, e perché non serve un banner di consenso.",
  sections: [
    {
      id: "summary",
      title: "In sintesi",
      body: (
        <P>
          Nandzz usa solo cookie e strumenti di archiviazione del browser <B>tecnici</B>. Li usiamo per farti
          accedere, proteggere il servizio e ricordare le tue impostazioni. <B>Non</B> usiamo cookie
          pubblicitari, di profilazione o di analisi di terze parti. Le statistiche sui visitatori non usano
          cookie. Ai sensi dell&apos;art. 122 del Codice Privacy e delle Linee guida cookie del Garante (10 giugno
          2021), i cookie tecnici non richiedono consenso, quindi non mostriamo un banner.
        </P>
      ),
    },
    {
      id: "inventory",
      title: "Cosa usiamo",
      body: inventory("it"),
    },
    {
      id: "third-parties",
      title: "Contenuti di terze parti",
      body: (
        <>
          <P>
            Non carichiamo tracker di terze parti. Alcune funzioni si collegano ad altri servizi solo quando le
            usi:
          </P>
          <Ul>
            <li>
              L&apos;<B>accesso con Google</B> avviene sulle pagine di Google, secondo le sue policy.
            </li>
            <li>
              Il <B>completamento degli indirizzi</B> invia a Google Places il testo che digiti, solo mentre
              inserisci un indirizzo.
            </li>
            <li>
              <B>Stripe Checkout</B> avviene sulle pagine di Stripe, che imposta i propri cookie antifrode.
            </li>
            <li>
              Le pagine e gli elementi incorporati pubblicati dagli utenti girano in frame isolati (sandbox). Ne
              rispondono i loro autori, e quei frame non possono leggere i cookie di Nandzz.
            </li>
          </Ul>
        </>
      ),
    },
    {
      id: "manage",
      title: "Gestione dei cookie",
      body: (
        <P>
          Puoi cancellare o bloccare i cookie dalle impostazioni del browser. Se blocchi i cookie di
          autenticazione, non potrai accedere. Se in futuro introdurremo cookie non necessari, ti chiederemo
          prima il consenso e potrai modificare la scelta in ogni momento. Maggiori informazioni sono disponibili
          sul sito del <A href={GARANTE_URL}>Garante</A>.
        </P>
      ),
    },
    {
      id: "contact",
      title: "Contatti",
      body: (
        <P>
          Domande: <Mail to={C.emails.privacy} />. Vedi anche l&apos;<A href="/privacy">Informativa privacy</A>.
        </P>
      ),
    },
  ],
};
