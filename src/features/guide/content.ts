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

export type GuideCopy = {
  metaTitle: string;
  metaDescription: string;
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
