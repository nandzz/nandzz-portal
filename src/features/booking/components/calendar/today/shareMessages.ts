import type { Locale } from "@/lib/i18n/translations";

// Ready-made texts an owner sends to their clients with the booking link. They
// live here (all 7 languages, tiny) rather than in the i18n dictionaries
// because the owner picks the language for their clients, independently of
// the dashboard's own language. `{url}` is replaced with the link.

export type ShareMessages = {
  // Native name, for the language picker.
  name: string;
  // Sent with the link (WhatsApp, email body, system share).
  message: string;
  emailSubject: string;
  // WhatsApp Business automatic away/greeting message.
  away: string;
  instagramBio: string;
};

export const SHARE_MESSAGES: Record<Locale, ShareMessages> = {
  en: {
    name: "English",
    message: "Hi! You can now book your appointment online in a few seconds: {url}",
    emailSubject: "Book your appointment online",
    away: "Thanks for your message! You can book your appointment online anytime: {url} We'll get back to you as soon as we can.",
    instagramBio: "📅 Book online 👇\n{url}",
  },
  it: {
    name: "Italiano",
    message: "Ciao! Ora puoi prenotare il tuo appuntamento online in pochi secondi: {url}",
    emailSubject: "Prenota il tuo appuntamento online",
    away: "Grazie per il messaggio! Puoi prenotare il tuo appuntamento online in qualsiasi momento: {url} Ti risponderemo appena possibile.",
    instagramBio: "📅 Prenota online 👇\n{url}",
  },
  pt: {
    name: "Português",
    message: "Olá! Agora você pode agendar seu horário online em poucos segundos: {url}",
    emailSubject: "Agende seu horário online",
    away: "Obrigado pela mensagem! Você pode agendar seu horário online a qualquer momento: {url} Responderemos assim que possível.",
    instagramBio: "📅 Agende online 👇\n{url}",
  },
  fr: {
    name: "Français",
    message: "Bonjour ! Vous pouvez désormais réserver votre rendez-vous en ligne en quelques secondes : {url}",
    emailSubject: "Réservez votre rendez-vous en ligne",
    away: "Merci pour votre message ! Vous pouvez réserver votre rendez-vous en ligne à tout moment : {url} Nous vous répondrons dès que possible.",
    instagramBio: "📅 Réservez en ligne 👇\n{url}",
  },
  es: {
    name: "Español",
    message: "¡Hola! Ahora puedes reservar tu cita online en pocos segundos: {url}",
    emailSubject: "Reserva tu cita online",
    away: "¡Gracias por tu mensaje! Puedes reservar tu cita online en cualquier momento: {url} Te responderemos lo antes posible.",
    instagramBio: "📅 Reserva online 👇\n{url}",
  },
  de: {
    name: "Deutsch",
    message: "Hallo! Sie können Ihren Termin jetzt in wenigen Sekunden online buchen: {url}",
    emailSubject: "Buchen Sie Ihren Termin online",
    away: "Danke für Ihre Nachricht! Sie können Ihren Termin jederzeit online buchen: {url} Wir melden uns so schnell wie möglich.",
    instagramBio: "📅 Online buchen 👇\n{url}",
  },
  ja: {
    name: "日本語",
    message: "こんにちは！ご予約はオンラインで簡単にできるようになりました：{url}",
    emailSubject: "オンラインでご予約ください",
    away: "メッセージありがとうございます！ご予約はオンラインでいつでも承っています：{url} 折り返しご連絡いたします。",
    instagramBio: "📅 オンライン予約はこちら 👇\n{url}",
  },
};

export function fillUrl(template: string, url: string) {
  return template.replace("{url}", url);
}
