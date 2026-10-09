import type { LegalLocale } from "./locale";

// Every third party that processes personal data on our behalf. Rendered by the
// Privacy Policy, the DPA (Annex: authorised sub-processors) and, for the
// cookie-relevant ones, the Cookie Policy. Adding a provider here is how it
// gets disclosed — keep this in sync with real integrations.

type Localized = Record<LegalLocale, string>;

export type Subprocessor = {
  name: string;
  purpose: Localized;
  data: Localized;
  location: Localized;
  safeguard: Localized;
  // True when the provider also processes data of a business's booking
  // customers (listed in the DPA annex).
  bookingData: boolean;
};

const EEA: Localized = { en: "EU/EEA", it: "UE/SEE" };
const US_DPF: Localized = {
  en: "EU–US Data Privacy Framework and/or Standard Contractual Clauses",
  it: "EU–US Data Privacy Framework e/o Clausole Contrattuali Standard",
};
const SCC: Localized = { en: "Standard Contractual Clauses", it: "Clausole Contrattuali Standard" };
const NONE: Localized = { en: "Not required (EU/EEA)", it: "Non necessarie (UE/SEE)" };

export const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "Supabase, Inc.",
    purpose: {
      en: "Database, authentication, file storage, server functions",
      it: "Database, autenticazione, archiviazione file, funzioni server",
    },
    data: {
      en: "All account, content, booking and billing records",
      it: "Tutti i dati di account, contenuti, prenotazioni e fatturazione",
    },
    location: { en: "EU (AWS Ireland / Frankfurt)", it: "UE (AWS Irlanda / Francoforte)" },
    safeguard: { en: "EU hosting; SCCs for support access from the US", it: "Hosting UE; CCS per accessi di supporto dagli USA" },
    bookingData: true,
  },
  {
    name: "Amazon Web Services EMEA SARL (Amplify, CloudFront, SES)",
    purpose: {
      en: "Website hosting and delivery; transactional email (booking confirmations and reminders)",
      it: "Hosting e distribuzione del sito; email transazionali (conferme e promemoria di prenotazione)",
    },
    data: {
      en: "IP address, request metadata, email address and message content",
      it: "Indirizzo IP, metadati delle richieste, indirizzo email e contenuto dei messaggi",
    },
    location: EEA,
    safeguard: NONE,
    bookingData: true,
  },
  {
    name: "Stripe Payments Europe, Ltd.",
    purpose: {
      en: "Payments, subscriptions, invoices, fraud prevention",
      it: "Pagamenti, abbonamenti, fatture, prevenzione frodi",
    },
    data: {
      en: "Name, email, billing address, payment method (we never see full card numbers)",
      it: "Nome, email, indirizzo di fatturazione, metodo di pagamento (non vediamo mai i numeri di carta)",
    },
    location: { en: "Ireland; Stripe, Inc. (US)", it: "Irlanda; Stripe, Inc. (USA)" },
    safeguard: US_DPF,
    bookingData: false,
  },
  {
    name: "Twilio Inc.",
    purpose: {
      en: "WhatsApp booking reminders and replies; phone verification SMS",
      it: "Promemoria e risposte WhatsApp per le prenotazioni; SMS di verifica del telefono",
    },
    data: {
      en: "Phone number, message content",
      it: "Numero di telefono, contenuto dei messaggi",
    },
    location: { en: "United States", it: "Stati Uniti" },
    safeguard: US_DPF,
    bookingData: true,
  },
  {
    name: "OpenAI, L.L.C.",
    purpose: {
      en: "AI agent answers and document search (embeddings)",
      it: "Risposte dell'agente IA e ricerca nei documenti (embedding)",
    },
    data: {
      en: "Chat messages typed by visitors; documents uploaded by the business",
      it: "Messaggi digitati dai visitatori; documenti caricati dall'attività",
    },
    location: { en: "United States", it: "Stati Uniti" },
    safeguard: US_DPF,
    bookingData: true,
  },
  {
    name: "Anthropic, PBC",
    purpose: {
      en: "AI-assisted editing of your content",
      it: "Modifica dei contenuti assistita dall'IA",
    },
    data: {
      en: "Content and instructions you submit to the AI editor",
      it: "Contenuti e istruzioni inviati all'editor IA",
    },
    location: { en: "United States", it: "Stati Uniti" },
    safeguard: SCC,
    bookingData: false,
  },
  {
    name: "Google Ireland Ltd. / Google LLC",
    purpose: {
      en: "Sign in with Google; address autocomplete (Places) when you type an address",
      it: "Accesso con Google; completamento automatico degli indirizzi (Places) quando si digita un indirizzo",
    },
    data: {
      en: "Google account name, email, avatar; typed address text and IP address",
      it: "Nome, email e avatar dell'account Google; testo dell'indirizzo digitato e indirizzo IP",
    },
    location: { en: "Ireland; United States", it: "Irlanda; Stati Uniti" },
    safeguard: US_DPF,
    bookingData: true,
  },
  {
    name: "Web3Forms",
    purpose: { en: "Delivery of contact-form messages", it: "Inoltro dei messaggi del modulo di contatto" },
    data: { en: "Name, email, message", it: "Nome, email, messaggio" },
    location: { en: "United States", it: "Stati Uniti" },
    safeguard: SCC,
    bookingData: false,
  },
];
