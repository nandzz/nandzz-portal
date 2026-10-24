import type { Locale } from "@/lib/i18n/translations";

// Copy for the home hero showcase. Slide 1 reuses the existing `home.*` hero
// strings (all locales); the tour slides live here in EN + IT, like the
// business guide — other locales fall back to English.
export type ShowcaseLocale = "en" | "it";

export function toShowcaseLocale(locale: Locale | string | null | undefined): ShowcaseLocale {
  return locale === "it" ? "it" : "en";
}

type Item = { label: string; desc: string };
type Tour = { eyebrow: string; title: string; items: Item[] };
type Example = { eyebrow: string; title: string; desc: string };

export type ShowcaseCopy = {
  controls: {
    region: string;
    slideOf: string; // "{n}" and "{total}" are replaced
    pause: string;
    play: string;
    prev: string;
    next: string;
    names: string[]; // one per slide, in order
  };
  anatomy: Tour;
  content: Tour;
  booking: {
    eyebrow: string;
    title: string;
    steps: Item[];
    businessTitle: string;
    business: string[];
    toasts: Item[];
  };
  style: Tour;
  links: Example;
  gallery: Example;
  mock: {
    bookNow: string;
    follow: string;
    followers: string;
    following: string;
    services: string;
    gallery: string;
    publications: string;
    links: string;
    chooseService: string;
    chooseProfessional: string;
    anyAvailable: string;
    pickTime: string;
    yourDetails: string;
    fullName: string;
    email: string;
    whatsapp: string;
    continue: string;
    confirm: string;
    confirmed: string;
    confirmedBody: string;
    style: string;
    tabPage: string;
    tabButtons: string;
    tabBooking: string;
    background: string;
    buttonColor: string;
    variants: [string, string, string, string]; // soft, solid, outline, glass
    layouts: [string, string, string, string]; // icons, chips, stack, minimal
    socialLinks: string;
    barberBio: string;
    barberServices: [string, string, string];
    physioBio: string;
    physioServices: [string, string, string];
    inkBio: string;
    inkPublications: [string, string];
    inkLinks: [string, string, string];
    bloomBio: string;
    yogaBio: string;
    yogaLinks: [string, string, string];
    rosaBio: string;
  };
};

const en: ShowcaseCopy = {
  controls: {
    region: "Example Nandzz pages",
    slideOf: "{n} of {total}",
    pause: "Pause",
    play: "Play",
    prev: "Previous",
    next: "Next",
    names: ["Intro", "Your page", "Content", "Booking", "Style", "Links first", "Gallery first"],
  },
  anatomy: {
    eyebrow: "Tour · Your page",
    title: "Everything clients need, on one page.",
    items: [
      { label: "Profile", desc: "Who you are and where to find you: name, bio and address." },
      { label: "Book now", desc: "Always in view, so booking is one tap away." },
      { label: "Services", desc: "Prices and durations, clear before anyone books." },
      { label: "Gallery", desc: "Your best work, ready to win the next client." },
    ],
  },
  content: {
    eyebrow: "Tour · Content",
    title: "More than a link in bio.",
    items: [
      { label: "Social links", desc: "Instagram, WhatsApp, email and more, all in one row." },
      { label: "Publications", desc: "Price lists, guides and PDFs clients can open on the spot." },
      { label: "Links", desc: "Your website, a shop, anything else, as tidy chips." },
      { label: "Followers", desc: "Clients follow your page and come back to book again." },
    ],
  },
  booking: {
    eyebrow: "Booking",
    title: "From tap to confirmed in seconds.",
    steps: [
      { label: "Service", desc: "One or more, with price and duration." },
      { label: "Professional", desc: "Someone specific, or whoever is free." },
      { label: "Date & time", desc: "Only real availability, nothing to double-check." },
      { label: "Details", desc: "Contact details and an optional reminder." },
      { label: "Confirmed", desc: "A confirmation email goes out straight away." },
    ],
    businessTitle: "On your side",
    business: [
      "A different professional for each service",
      "Multiple locations",
      "Automatic reminders",
      "Clients reschedule online",
      "Agenda, clients and team in one place",
    ],
    toasts: [
      { label: "New booking", desc: "Sports massage · Tue 10:30" },
      { label: "Email sent", desc: "Confirmation to the client" },
      { label: "Reminder scheduled", desc: "The day before" },
    ],
  },
  style: {
    eyebrow: "Style",
    title: "Your brand, your colors.",
    items: [
      { label: "Background", desc: "Any color you like. The page adapts its contrast for you." },
      { label: "Buttons", desc: "Tint your social buttons to match your brand." },
      { label: "Booking button", desc: "Soft, solid, outline or glass, in the shape you prefer." },
      { label: "Social links", desc: "Icons, chips, a stacked list or minimal." },
    ],
  },
  links: {
    eyebrow: "Example · Links first",
    title: "Simple, link-first.",
    desc: "Stacked links and a booking button front and center. Turn off the sections you don't need and keep only what matters.",
  },
  gallery: {
    eyebrow: "Example · Gallery first",
    title: "Let your work speak.",
    desc: "A dark page and a full gallery, for photographers, tattoo artists and anyone whose portfolio does the selling.",
  },
  mock: {
    bookNow: "Book now",
    follow: "Follow",
    followers: "followers",
    following: "following",
    services: "Services",
    gallery: "Gallery",
    publications: "Publications",
    links: "Links",
    chooseService: "Choose a service",
    chooseProfessional: "Choose a professional",
    anyAvailable: "Any available",
    pickTime: "Pick a time",
    yourDetails: "Your details",
    fullName: "Full name",
    email: "Email",
    whatsapp: "Remind me on WhatsApp",
    continue: "Continue",
    confirm: "Confirm booking",
    confirmed: "Booking confirmed",
    confirmedBody: "We've sent the details to your email.",
    style: "Style",
    tabPage: "Page",
    tabButtons: "Buttons",
    tabBooking: "Booking",
    background: "Background",
    buttonColor: "Button color",
    variants: ["Soft", "Solid", "Outline", "Glass"],
    layouts: ["Icons", "Chips", "Stack", "Minimal"],
    socialLinks: "Social links",
    barberBio: "Classic cuts and hot-towel shaves since 2014.",
    barberServices: ["Haircut", "Beard trim", "Cut & beard"],
    physioBio: "Sports physiotherapy and massage.",
    physioServices: ["Sports massage", "Physio session", "Posture check"],
    inkBio: "Fine-line tattoos, by appointment only.",
    inkPublications: ["Price list 2026", "Aftercare guide"],
    inkLinks: ["Website", "Aftercare shop", "Reviews"],
    bloomBio: "Gel, nail art and a good chat.",
    yogaBio: "Private yoga and breathwork sessions.",
    yogaLinks: ["Website", "Free breathwork video", "Newsletter"],
    rosaBio: "Portrait and wedding photography.",
  },
};

const it: ShowcaseCopy = {
  controls: {
    region: "Esempi di pagine Nandzz",
    slideOf: "{n} di {total}",
    pause: "Pausa",
    play: "Riproduci",
    prev: "Precedente",
    next: "Successivo",
    names: ["Intro", "La tua pagina", "Contenuti", "Prenotazione", "Stile", "Prima i link", "Prima la galleria"],
  },
  anatomy: {
    eyebrow: "Tour · La tua pagina",
    title: "Tutto ciò che serve ai clienti, in una pagina.",
    items: [
      { label: "Profilo", desc: "Chi sei e dove trovarti: nome, bio e indirizzo." },
      { label: "Prenota ora", desc: "Sempre in vista: prenotare è a un tocco." },
      { label: "Servizi", desc: "Prezzi e durate chiari, prima ancora di prenotare." },
      { label: "Galleria", desc: "I tuoi lavori migliori, pronti a conquistare il prossimo cliente." },
    ],
  },
  content: {
    eyebrow: "Tour · Contenuti",
    title: "Molto più di un link in bio.",
    items: [
      { label: "Social", desc: "Instagram, WhatsApp, email e altro, tutto in una riga." },
      { label: "Pubblicazioni", desc: "Listini, guide e PDF che i clienti aprono al volo." },
      { label: "Link", desc: "Il tuo sito, uno shop o qualsiasi altra cosa, in chip ordinate." },
      { label: "Follower", desc: "I clienti seguono la tua pagina e tornano a prenotare." },
    ],
  },
  booking: {
    eyebrow: "Prenotazione online",
    title: "Dal tocco alla conferma in pochi secondi.",
    steps: [
      { label: "Servizio", desc: "Uno o più, con prezzo e durata." },
      { label: "Professionista", desc: "Una persona precisa o il primo disponibile." },
      { label: "Data e ora", desc: "Solo disponibilità reali, niente da ricontrollare." },
      { label: "Dati", desc: "Contatti e un promemoria facoltativo." },
      { label: "Confermato", desc: "L'email di conferma parte subito." },
    ],
    businessTitle: "Nel tuo gestionale",
    business: [
      "Un professionista diverso per ogni servizio",
      "Più sedi",
      "Promemoria automatici",
      "I clienti spostano l'appuntamento online",
      "Agenda, clienti e team in un unico posto",
    ],
    toasts: [
      { label: "Nuova prenotazione", desc: "Massaggio sportivo · mar 10:30" },
      { label: "Email inviata", desc: "Conferma al cliente" },
      { label: "Promemoria programmato", desc: "Il giorno prima" },
    ],
  },
  style: {
    eyebrow: "Stile",
    title: "Il tuo brand, i tuoi colori.",
    items: [
      { label: "Sfondo", desc: "Il colore che preferisci. La pagina adatta il contrasto da sola." },
      { label: "Pulsanti", desc: "Colora i pulsanti social con i toni del tuo brand." },
      { label: "Pulsante prenota", desc: "Soft, pieno, contorno o vetro, nella forma che preferisci." },
      { label: "Link social", desc: "Icone, chip, elenco o minimal." },
    ],
  },
  links: {
    eyebrow: "Esempio · Prima i link",
    title: "Semplice, con i link in primo piano.",
    desc: "Link in colonna e il pulsante per prenotare in bella vista. Disattiva le sezioni che non ti servono e tieni solo l'essenziale.",
  },
  gallery: {
    eyebrow: "Esempio · Prima la galleria",
    title: "Lascia parlare il tuo lavoro.",
    desc: "Una pagina scura e una galleria piena, per fotografi, tatuatori e chiunque venda con il proprio portfolio.",
  },
  mock: {
    bookNow: "Prenota ora",
    follow: "Segui",
    followers: "follower",
    following: "seguiti",
    services: "Servizi",
    gallery: "Galleria",
    publications: "Pubblicazioni",
    links: "Link",
    chooseService: "Scegli un servizio",
    chooseProfessional: "Scegli un professionista",
    anyAvailable: "Il primo libero",
    pickTime: "Scegli l'orario",
    yourDetails: "I tuoi dati",
    fullName: "Nome e cognome",
    email: "Email",
    whatsapp: "Promemoria su WhatsApp",
    continue: "Continua",
    confirm: "Conferma prenotazione",
    confirmed: "Prenotazione confermata",
    confirmedBody: "Ti abbiamo inviato i dettagli via email.",
    style: "Stile",
    tabPage: "Pagina",
    tabButtons: "Pulsanti",
    tabBooking: "Prenota",
    background: "Sfondo",
    buttonColor: "Colore pulsanti",
    variants: ["Soft", "Pieno", "Contorno", "Vetro"],
    layouts: ["Icone", "Chip", "Elenco", "Minimal"],
    socialLinks: "Link social",
    barberBio: "Tagli classici e rasature con panno caldo dal 2014.",
    barberServices: ["Taglio", "Regolazione barba", "Taglio e barba"],
    physioBio: "Fisioterapia sportiva e massaggi.",
    physioServices: ["Massaggio sportivo", "Seduta di fisioterapia", "Analisi posturale"],
    inkBio: "Tatuaggi fine line, solo su appuntamento.",
    inkPublications: ["Listino 2026", "Guida alla cura"],
    inkLinks: ["Sito web", "Shop aftercare", "Recensioni"],
    bloomBio: "Gel, nail art e due chiacchiere.",
    yogaBio: "Lezioni private di yoga e respirazione.",
    yogaLinks: ["Sito web", "Video di respirazione gratuito", "Newsletter"],
    rosaBio: "Fotografia di ritratto e matrimonio.",
  },
};

export const SHOWCASE_COPY: Record<ShowcaseLocale, ShowcaseCopy> = { en, it };
