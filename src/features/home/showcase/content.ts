import type { Locale } from "@/lib/i18n/translations";

// Copy for the home hero showcase. Slide 1 reuses the existing `home.*` hero
// strings (all locales); the tour slides live here in EN + IT, like the
// business guide — other locales fall back to English.
//
// Rule: the showcase only shows what the real platform has. Strings inside the
// phone (`mock`) mirror the real UI labels (booking strings = `t.booking.*`,
// profile strings = `t.profile.*`, Style picker labels = ProfileStylePicker).
export type ShowcaseLocale = "en" | "it";

export function toShowcaseLocale(locale: Locale | string | null | undefined): ShowcaseLocale {
  return locale === "it" ? "it" : "en";
}

type Item = { label: string; desc: string };
type Tour = { eyebrow: string; title: string; items: Item[] };
type Example = { eyebrow: string; title: string; desc: string };
type Four = [string, string, string, string];

export type ShowcaseCopy = {
  controls: {
    region: string;
    slideOf: string; // "{n}" and "{total}" are replaced
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
    // Public profile
    bookNow: string;
    follow: string;
    followers: string;
    following: string;
    gallery: string;
    publications: string;
    links: string;
    // Booking page (CalendarBookingFlow)
    share: string;
    back: string;
    chooseService: string;
    selectServicesHint: string;
    total: string;
    continue: string;
    chooseSpecialist: string;
    specialistHint: string;
    anyAvailable: string;
    pickDateTime: string; // "{service}" is replaced
    signInTitle: string;
    signInBody: string;
    signInCta: string;
    summaryService: string;
    summaryWhen: string;
    summarySpecialist: string;
    yourDetails: string;
    fullName: string;
    emailOptional: string;
    phone: string;
    whatsapp: string;
    confirm: string;
    booked: string;
    withName: string; // "{name}" is replaced
    confirmationSent: string; // "{email}" is replaced
    manageBooking: string;
    // Style picker (owner)
    style: string;
    reset: string;
    tabPage: string;
    tabButtons: string;
    tabBooking: string;
    background: string;
    buttonColor: string;
    defaultColor: string;
    variantLabel: string;
    variants: Four; // soft, solid, outline, glass
    layoutLabel: string;
    layouts: Four; // icons, labeled, stacked, minimal
    layoutHints: Four;
    // Example businesses
    barberBio: string;
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
    prev: "Previous",
    next: "Next",
    names: ["Intro", "Your page", "Content", "Booking", "Style", "Links first", "Gallery first"],
  },
  anatomy: {
    eyebrow: "Tour · Your page",
    title: "Everything clients need, on one page.",
    items: [
      { label: "Profile", desc: "Your photo, name and bio, at nandzz.com/yourname." },
      { label: "Book now", desc: "Right under your name, so booking is one tap away." },
      { label: "Address", desc: "Opens in Maps, or copy and share it in a tap." },
      { label: "Gallery", desc: "Your best work, ready to win the next client." },
    ],
  },
  content: {
    eyebrow: "Tour · Content",
    title: "More than a link in bio.",
    items: [
      { label: "Social links", desc: "Instagram, WhatsApp, email, your website and more." },
      { label: "Publications", desc: "Price lists, guides and PDFs clients can open on the spot." },
      { label: "Links", desc: "A shop, reviews, anything else, as cards, rows or pills." },
      { label: "Followers", desc: "Clients follow your page and see your new posts in their feed." },
    ],
  },
  booking: {
    eyebrow: "Booking",
    title: "From tap to confirmed in seconds.",
    steps: [
      { label: "Service", desc: "One or more: times and prices add up." },
      { label: "Specialist", desc: "Someone specific, or whoever is free." },
      { label: "Date & time", desc: "Only real availability, nothing to double-check." },
      { label: "Details", desc: "Name and phone, or log in to autofill them." },
      { label: "Confirmed", desc: "Confirmation by email, with a link to reschedule or cancel." },
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
      { label: "Buttons", desc: "Tint your link buttons and address to match your brand." },
      { label: "Booking button", desc: "Soft, solid, outline or glass, in your color and position." },
      { label: "Social links", desc: "Icons, labeled, stacked or minimal." },
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
    gallery: "Gallery",
    publications: "Publications",
    links: "Links",
    share: "Share",
    back: "Back",
    chooseService: "Choose a service",
    selectServicesHint: "Select one or more: times and prices add up.",
    total: "Total",
    continue: "Continue",
    chooseSpecialist: "Choose your specialist",
    specialistHint: "Pick who handles each service, or leave it to us.",
    anyAvailable: "Any available",
    pickDateTime: "Pick a date & time · {service}",
    signInTitle: "Book faster",
    signInBody: "Log in or sign up to autofill your details.",
    signInCta: "Log in / Sign up",
    summaryService: "Service",
    summaryWhen: "When",
    summarySpecialist: "Specialist",
    yourDetails: "Your details",
    fullName: "Full name",
    emailOptional: "Email (optional)",
    phone: "Phone",
    whatsapp: "Send me a WhatsApp reminder before my appointment",
    confirm: "Confirm booking",
    booked: "You're booked!",
    withName: "with {name}",
    confirmationSent: "A confirmation was sent to {email}. You can reschedule or cancel anytime.",
    manageBooking: "Manage your booking",
    style: "Style",
    reset: "Reset",
    tabPage: "Page",
    tabButtons: "Buttons",
    tabBooking: "Booking",
    background: "Background",
    buttonColor: "Button color",
    defaultColor: "Default",
    variantLabel: "Style",
    variants: ["Soft", "Solid", "Outline", "Glass"],
    layoutLabel: "Layout",
    layouts: ["Icons", "Labeled", "Stacked", "Minimal"],
    layoutHints: ["Compact tiles", "Icon + name", "Full-width buttons", "Just the glyphs"],
    barberBio: "Classic cuts and hot-towel shaves since 2014.",
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
    prev: "Precedente",
    next: "Successivo",
    names: ["Intro", "La tua pagina", "Contenuti", "Prenotazione", "Stile", "Prima i link", "Prima la galleria"],
  },
  anatomy: {
    eyebrow: "Tour · La tua pagina",
    title: "Tutto ciò che serve ai clienti, in una pagina.",
    items: [
      { label: "Profilo", desc: "Foto, nome e bio, su nandzz.com/iltuonome." },
      { label: "Prenota ora", desc: "Subito sotto il nome: prenotare è a un tocco." },
      { label: "Indirizzo", desc: "Si apre in Maps, oppure lo copi e lo condividi con un tocco." },
      { label: "Galleria", desc: "I tuoi lavori migliori, pronti a conquistare il prossimo cliente." },
    ],
  },
  content: {
    eyebrow: "Tour · Contenuti",
    title: "Molto più di un link in bio.",
    items: [
      { label: "Social", desc: "Instagram, WhatsApp, email, il tuo sito e altro." },
      { label: "Pubblicazioni", desc: "Listini, guide e PDF che i clienti aprono al volo." },
      { label: "Link", desc: "Uno shop, le recensioni o qualsiasi altra cosa, come schede, righe o pillole." },
      { label: "Follower", desc: "I clienti seguono la tua pagina e vedono i nuovi post nel loro feed." },
    ],
  },
  booking: {
    eyebrow: "Prenotazione online",
    title: "Dal tocco alla conferma in pochi secondi.",
    steps: [
      { label: "Servizio", desc: "Uno o più: durata e prezzo si sommano." },
      { label: "Specialista", desc: "Una persona precisa o chiunque sia disponibile." },
      { label: "Data e ora", desc: "Solo disponibilità reali, niente da ricontrollare." },
      { label: "Dati", desc: "Nome e telefono, oppure accedi per compilarli in automatico." },
      { label: "Confermato", desc: "Conferma via email, con il link per spostare o annullare." },
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
      { label: "Pulsanti", desc: "Colora i pulsanti dei link e l'indirizzo con i toni del tuo brand." },
      { label: "Pulsante prenota", desc: "Soft, pieno, contorno o vetro, nel tuo colore e nella posizione che vuoi." },
      { label: "Link social", desc: "Icone, con nome, in colonna o minimal." },
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
    gallery: "Galleria",
    publications: "Pubblicazioni",
    links: "Link",
    share: "Condividi",
    back: "Indietro",
    chooseService: "Scegli un servizio",
    selectServicesHint: "Seleziona uno o più: durata e prezzo si sommano.",
    total: "Totale",
    continue: "Continua",
    chooseSpecialist: "Scegli il tuo specialista",
    specialistHint: "Scegli chi esegue ogni servizio, o lascia fare a noi.",
    anyAvailable: "Chiunque sia disponibile",
    pickDateTime: "Scegli data e ora · {service}",
    signInTitle: "Prenota più veloce",
    signInBody: "Accedi o registrati per compilare automaticamente.",
    signInCta: "Accedi / Registrati",
    summaryService: "Servizio",
    summaryWhen: "Quando",
    summarySpecialist: "Operatore",
    yourDetails: "I tuoi dati",
    fullName: "Nome completo",
    emailOptional: "Email (facoltativa)",
    phone: "Telefono",
    whatsapp: "Inviami un promemoria su WhatsApp prima dell'appuntamento",
    confirm: "Conferma prenotazione",
    booked: "Sei prenotato!",
    withName: "con {name}",
    confirmationSent:
      "Una conferma è stata inviata a {email}. Puoi riprogrammare o annullare in qualsiasi momento.",
    manageBooking: "Gestisci la tua prenotazione",
    style: "Stile",
    reset: "Ripristina",
    tabPage: "Pagina",
    tabButtons: "Pulsanti",
    tabBooking: "Prenota",
    background: "Sfondo",
    buttonColor: "Colore pulsanti",
    defaultColor: "Predefinito",
    variantLabel: "Stile",
    variants: ["Soft", "Pieno", "Contorno", "Vetro"],
    layoutLabel: "Layout",
    layouts: ["Icone", "Con nome", "In colonna", "Minimal"],
    layoutHints: ["Riquadri compatti", "Icona + nome", "Pulsanti larghi", "Solo le icone"],
    barberBio: "Tagli classici e rasature con panno caldo dal 2014.",
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
