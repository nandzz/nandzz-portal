import type { Locale } from "@/lib/i18n/translations";

// Copy for the public /guide page. Written in English and Italian; every other
// app locale reads English (same policy as the legal pages). Strings shown
// inside the mock visuals live here too so the illustrations are localized.

export type GuideLocale = "en" | "it";

export function toGuideLocale(locale: Locale | string | null | undefined): GuideLocale {
  return locale === "it" ? "it" : "en";
}

export type GuideStepId = "claim" | "style" | "content" | "booking" | "share" | "insights";

export type GuideStep = {
  id: GuideStepId;
  title: string;
  body: string;
  tips: string[];
};

export type GuideFaq = { q: string; a: string };

export type GuideCopy = {
  metaTitle: string;
  metaDescription: string;
  // First slide of the showcase that opens the page.
  hero: { line1: string; line2: string; description: string; whatLink: string };
  what: {
    title: string;
    body: string;
    clients: { title: string; items: string[] };
    business: { title: string; items: string[] };
  };
  faqTitle: string;
  faq: GuideFaq[];
  title: string;
  subtitle: string;
  cta: string;
  pricingLink: string;
  stepsLabel: string;
  steps: GuideStep[];
  paidNote: string;
  closingTitle: string;
  closingBody: string;
  visual: {
    available: string;
    yourPage: string;
    background: string;
    buttons: string;
    bookNow: string;
    tabs: [string, string, string, string];
    services: { name: string; duration: string; price: string }[];
    pickTime: string;
    copyLink: string;
    newBooking: string;
    newBookingDetail: string;
    visitors: string;
    thisWeek: string;
    days: string[];
  };
};

const en: GuideCopy = {
  metaTitle: "Guide: set up your business on Nandzz",
  metaDescription:
    "How to set up your Nandzz page in six steps: claim your link, add your style and content, turn on booking, and share it with your clients.",
  hero: {
    line1: "How Nandzz works,",
    line2: "for you and *your clients*",
    description:
      "One page for your link in bio, with online booking for your clients and a back office for you. Here's what you get, what it costs and how to set it up.",
    whatLink: "What you get",
  },
  what: {
    title: "What you get",
    body: "One page to put as your Instagram link in bio, with your gallery, address, WhatsApp and Instagram, in your style. On top of it:",
    clients: {
      title: "For your clients: online booking",
      items: [
        "They book on their own, 24/7: they pick a service and a free time, without messaging you.",
        "They get a confirmation by email right away.",
        "Automatic reminders by email and WhatsApp, so fewer appointments are missed.",
        "They can reschedule or cancel on their own, and the slot frees up.",
      ],
    },
    business: {
      title: "For you: the back office",
      items: [
        "A calendar with every booking by day, week and month.",
        "Client records that build themselves: contacts and visit history (when, what, how much spent).",
        "Your team: each person's hours and services, and you can reassign appointments.",
        "Services by category with price and duration, editable anytime.",
        "Closures and holidays blocked in one click.",
      ],
    },
  },
  faqTitle: "Questions",
  faq: [
    {
      q: "We built a page for you. What now?",
      a: "Open the link we sent you to claim it and sign in with email or Google. The page becomes yours with everything already set up. Services and durations are only a starting point: you can change all of it in a few minutes.",
    },
    {
      q: "Who can see my page before I claim it?",
      a: "Only people who have the link. It stays private until you claim it.",
    },
    {
      q: "What if I don't claim it?",
      a: "Pages we create for a business are deleted automatically if they aren't claimed within 7 days.",
    },
    {
      q: "How much does it cost?",
      a: "The Free plan covers your page, gallery and links. Online booking and analytics are on Pro, paid monthly or yearly (yearly costs less). Every plan is on the pricing page.",
    },
    {
      q: "Will I be charged when the free period ends?",
      a: "No. Nothing is charged automatically when a free period ends. You only pay if you choose a plan yourself.",
    },
    {
      q: "How do payments work?",
      a: "Payments and plan changes happen only on nandzz.com, from your dashboard. Never through messages or third parties.",
    },
    {
      q: "Can you help me set it up?",
      a: "Yes. Reply to our message or write to us from the contact page, and we'll set it up with you.",
    },
  ],
  title: "Your business page, live in an afternoon",
  subtitle:
    "Six short steps take you from sign-up to your first booking. No website, no designer, nothing to install.",
  cta: "Create your page",
  pricingLink: "See pricing",
  stepsLabel: "Steps",
  steps: [
    {
      id: "claim",
      title: "Claim your link",
      body: "Sign up with email or Google, then pick a username. That becomes your address: nandzz.com/yourbrand.",
      tips: ["Use the name clients already search for.", "You can change it later in Settings."],
    },
    {
      id: "style",
      title: "Make it look like you",
      body: "Add your logo, a short bio, your address and social links. Open Style to set your background and button colors.",
      tips: ["Your page keeps your colors on every device.", "Use Preview to see it exactly as visitors do."],
    },
    {
      id: "content",
      title: "Show your work",
      body: "Add photos to your Gallery, publish pages and PDFs as Content, and collect every link you use in Links.",
      tips: ["Turn any section off if you don't need it.", "Clients can follow you and save what they like."],
    },
    {
      id: "booking",
      title: "Turn on booking",
      body: "List your services with duration and price, set your opening hours, and add your staff. Clients book free slots 24/7.",
      tips: [
        "Each service can go to a different team member.",
        "Clients get confirmation and reminder emails automatically.",
      ],
    },
    {
      id: "share",
      title: "Share your link",
      body: "Put your link in your Instagram bio, Google profile and WhatsApp. Every new booking lands in your dashboard and inbox.",
      tips: ["Clients can reschedule or cancel on their own.", "You can move or reassign bookings anytime."],
    },
    {
      id: "insights",
      title: "See what's working",
      body: "Analytics shows how many people visit your page and what they open, so you know which posts bring clients in.",
      tips: ["Visitor counts are cookieless and private."],
    },
  ],
  paidNote: "Booking and analytics are part of the paid plan. Everything else is free.",
  closingTitle: "Ready when you are",
  closingBody: "Most businesses finish setup in under an hour.",
  visual: {
    available: "Available",
    yourPage: "Your page",
    background: "Background",
    buttons: "Buttons",
    bookNow: "Book now",
    tabs: ["All", "Content", "Gallery", "Links"],
    services: [
      { name: "Cut & style", duration: "45 min", price: "€40" },
      { name: "Colour", duration: "90 min", price: "€75" },
      { name: "Beard trim", duration: "20 min", price: "€18" },
    ],
    pickTime: "Thursday",
    copyLink: "Copy",
    newBooking: "New booking",
    newBookingDetail: "Cut & style, Thu 10:30",
    visitors: "Visitors",
    thisWeek: "this week",
    days: ["M", "T", "W", "T", "F", "S", "S"],
  },
};

const it: GuideCopy = {
  metaTitle: "Guida: porta la tua attività su Nandzz",
  metaDescription:
    "Come configurare la tua pagina Nandzz in sei passi: scegli il tuo link, aggiungi stile e contenuti, attiva le prenotazioni e condividila con i clienti.",
  hero: {
    line1: "Come funziona Nandzz,",
    line2: "per te e *i tuoi clienti*",
    description:
      "Una pagina da mettere come link in bio, con la prenotazione online per i tuoi clienti e un gestionale per te. Qui trovi cosa include, quanto costa e come configurarla.",
    whatLink: "Cosa include",
  },
  what: {
    title: "Cosa include",
    body: "Una pagina unica da mettere come link in bio su Instagram, con galleria, indirizzo, WhatsApp e Instagram, nel tuo stile. In più:",
    clients: {
      title: "Per i tuoi clienti: la prenotazione online",
      items: [
        "Prenotano da soli, 24/7: scelgono il servizio e l'orario libero, senza scriverti.",
        "Ricevono subito la conferma via email.",
        "Promemoria automatico via email e WhatsApp: meno appuntamenti saltati.",
        "Possono spostare o cancellare da soli, e lo slot si libera.",
      ],
    },
    business: {
      title: "Per te: il gestionale",
      items: [
        "Un'agenda con tutte le prenotazioni per giorno, settimana e mese.",
        "Schede clienti che si creano da sole: contatti e storico visite (quando, cosa, quanto speso).",
        "Il tuo team: orari e servizi di ciascuno, con la possibilità di riassegnare gli appuntamenti.",
        "Servizi divisi per categoria con prezzo e durata, modificabili quando vuoi.",
        "Giorni di chiusura e ferie bloccati in un clic.",
      ],
    },
  },
  faqTitle: "Domande",
  faq: [
    {
      q: "Ti abbiamo creato una pagina: e ora?",
      a: "Apri il link che ti abbiamo inviato per prenderne possesso e accedi con email o Google. La pagina diventa tua, con tutto già configurato. Servizi e durate sono solo un punto di partenza: puoi modificare tutto in pochi minuti.",
    },
    {
      q: "Chi vede la pagina prima che la attivi?",
      a: "Solo chi ha il link. Resta privata finché non ne prendi possesso.",
    },
    {
      q: "E se non la attivo?",
      a: "Le pagine che creiamo per un'attività vengono cancellate automaticamente se non vengono attivate entro 7 giorni.",
    },
    {
      q: "Quanto costa?",
      a: "Il piano Free include pagina, galleria e link. Prenotazione online e statistiche sono nel piano Pro, mensile o annuale (l'annuale costa meno). Tutti i piani sono nella pagina dei prezzi.",
    },
    {
      q: "Mi verrà addebitato qualcosa alla fine del periodo gratuito?",
      a: "No. Alla fine del periodo gratuito non viene addebitato nulla in automatico: paghi solo se scegli tu un piano.",
    },
    {
      q: "Come funzionano i pagamenti?",
      a: "Pagamenti e cambi di piano avvengono solo su nandzz.com, dalla tua dashboard. Mai tramite messaggi o terzi.",
    },
    {
      q: "Mi aiutate a configurarla?",
      a: "Sì. Rispondi al nostro messaggio o scrivici dalla pagina contatti e la sistemiamo insieme.",
    },
  ],
  title: "La pagina della tua attività, online in un pomeriggio",
  subtitle:
    "Sei passi veloci dalla registrazione alla prima prenotazione. Niente sito, niente designer, niente da installare.",
  cta: "Crea la tua pagina",
  pricingLink: "Vedi i prezzi",
  stepsLabel: "Passi",
  steps: [
    {
      id: "claim",
      title: "Scegli il tuo link",
      body: "Registrati con email o Google, poi scegli un nome utente. Diventa il tuo indirizzo: nandzz.com/tuobrand.",
      tips: ["Usa il nome che i clienti cercano già.", "Puoi cambiarlo in seguito dalle Impostazioni."],
    },
    {
      id: "style",
      title: "Rendila tua",
      body: "Aggiungi logo, una breve bio, indirizzo e social. Apri Stile per scegliere i colori di sfondo e dei pulsanti.",
      tips: ["La pagina mantiene i tuoi colori su ogni dispositivo.", "Usa Anteprima per vederla come i visitatori."],
    },
    {
      id: "content",
      title: "Mostra il tuo lavoro",
      body: "Aggiungi foto alla Galleria, pubblica pagine e PDF come Contenuti e raccogli tutti i tuoi link in Link.",
      tips: ["Puoi disattivare le sezioni che non ti servono.", "I clienti possono seguirti e salvare ciò che amano."],
    },
    {
      id: "booking",
      title: "Attiva le prenotazioni",
      body: "Elenca i servizi con durata e prezzo, imposta gli orari di apertura e aggiungi il tuo staff. I clienti prenotano 24 ore su 24.",
      tips: [
        "Ogni servizio può essere assegnato a un membro diverso del team.",
        "I clienti ricevono in automatico email di conferma e promemoria.",
      ],
    },
    {
      id: "share",
      title: "Condividi il tuo link",
      body: "Metti il link nella bio di Instagram, nel profilo Google e su WhatsApp. Ogni nuova prenotazione arriva nella tua dashboard e via email.",
      tips: ["I clienti possono spostare o annullare da soli.", "Puoi spostare o riassegnare le prenotazioni quando vuoi."],
    },
    {
      id: "insights",
      title: "Scopri cosa funziona",
      body: "Le statistiche mostrano quante persone visitano la tua pagina e cosa aprono, così sai quali contenuti portano clienti.",
      tips: ["Il conteggio dei visitatori è senza cookie e anonimo."],
    },
  ],
  paidNote: "Prenotazioni e statistiche fanno parte del piano a pagamento. Tutto il resto è gratis.",
  closingTitle: "Quando vuoi, sei pronto",
  closingBody: "La maggior parte delle attività completa la configurazione in meno di un'ora.",
  visual: {
    available: "Disponibile",
    yourPage: "La tua pagina",
    background: "Sfondo",
    buttons: "Pulsanti",
    bookNow: "Prenota",
    tabs: ["Tutti", "Contenuti", "Galleria", "Link"],
    services: [
      { name: "Taglio e piega", duration: "45 min", price: "€40" },
      { name: "Colore", duration: "90 min", price: "€75" },
      { name: "Barba", duration: "20 min", price: "€18" },
    ],
    pickTime: "Giovedì",
    copyLink: "Copia",
    newBooking: "Nuova prenotazione",
    newBookingDetail: "Taglio e piega, gio 10:30",
    visitors: "Visitatori",
    thisWeek: "questa settimana",
    days: ["L", "M", "M", "G", "V", "S", "D"],
  },
};

export const GUIDE_COPY: Record<GuideLocale, GuideCopy> = { en, it };
