import type {
  ActivityItem,
  Conversation,
  Workflow,
} from "./types";

// Placeholder data for the My Agent UI. Everything is anchored on one `now`
// passed down from the server render, so the server and client produce the
// same relative times (no hydration mismatch). Replace with real reads once the
// agent runtime writes conversations / feed events / approvals to Supabase.

export function buildMockData(now: number) {
  const ago = (min: number) => new Date(now - min * 60_000).toISOString();
  const ahead = (min: number) => new Date(now + min * 60_000).toISOString();

  const activity: ActivityItem[] = [
    {
      id: "a1",
      kind: "approval",
      customer: "Giulia Rossi",
      phone: "+39 333 •••• 412",
      title: "New booking waiting for approval",
      detail: "Haircut + colour · Thu 30 Oct, 15:00 · with Marco",
      reason: "New booking is set to Pending",
      at: ago(4),
      pending: { service: "Haircut + colour", when: "Thu 30 Oct, 15:00", staff: "Marco" },
    },
    {
      id: "a2",
      kind: "handoff",
      customer: "Luca Bianchi",
      phone: "+39 347 •••• 090",
      title: "Handed off to you",
      detail: "Asked about a refund for last week's appointment",
      reason: "Rule: When a customer asks for money back → hand off",
      at: ago(18),
    },
    {
      id: "a3",
      kind: "booking_created",
      customer: "Sara Conti",
      phone: "+39 320 •••• 771",
      title: "Booking confirmed",
      detail: "Beard trim · Sat 1 Nov, 10:30 · with Anna",
      at: ago(42),
    },
    {
      id: "a4",
      kind: "rule",
      customer: "Paolo Greco",
      phone: "+39 389 •••• 238",
      title: "Cancellation policy sent",
      detail: "Customer cancelled less than 24 h before the visit",
      reason: "Rule: When a customer cancels → send the cancellation policy",
      at: ago(75),
    },
    {
      id: "a5",
      kind: "rescheduled",
      customer: "Elena Ricci",
      phone: "+39 331 •••• 554",
      title: "Reschedule waiting for approval",
      detail: "Manicure · moved from Fri 31 Oct to Mon 3 Nov, 11:00",
      reason: "Reschedule is set to Pending",
      at: ago(130),
      pending: { service: "Manicure", when: "Mon 3 Nov, 11:00", staff: "Anna" },
    },
    {
      id: "a6",
      kind: "cancelled",
      customer: "Marco Ferri",
      phone: "+39 340 •••• 116",
      title: "Booking cancelled",
      detail: "Haircut · Wed 29 Oct, 18:00",
      at: ago(240),
    },
    {
      id: "a7",
      kind: "error",
      customer: "+39 351 •••• 802",
      phone: "+39 351 •••• 802",
      title: "Couldn't read a voice note",
      detail: "The media link expired before it was downloaded. The customer was asked to resend it.",
      at: ago(380),
    },
  ];

  const conversations: Conversation[] = [
    {
      id: "c1",
      customer: "Giulia Rossi",
      phone: "+39 333 •••• 412",
      state: "waiting",
      intent: "New booking",
      language: "Italian",
      updatedAt: ago(4),
      messages: [
        { id: "m1", from: "customer", text: "Ciao! Avete posto giovedì pomeriggio per taglio e colore?", at: ago(9) },
        { id: "m2", from: "agent", text: "Ciao Giulia! Sono Nina, l'assistente AI del salone. Giovedì 30 ho libero alle 15:00 con Marco o alle 17:30 con Anna. Quale preferisci?", at: ago(8) },
        { id: "m3", from: "customer", text: "Le 15 con Marco va benissimo", at: ago(6) },
        { id: "m4", from: "agent", text: "Perfetto: taglio + colore, giovedì 30 ottobre alle 15:00 con Marco. Confermi?", at: ago(5) },
        { id: "m5", from: "customer", text: "Sì confermo 👍", at: ago(4) },
        { id: "m6", from: "agent", text: "Grazie! Ho inviato la richiesta al salone, ti scrivo appena è confermata.", at: ago(4) },
      ],
    },
    {
      id: "c2",
      customer: "Luca Bianchi",
      phone: "+39 347 •••• 090",
      state: "taken_over",
      intent: "Refund request",
      language: "Italian",
      resumesAt: ahead(3),
      updatedAt: ago(2),
      messages: [
        { id: "m1", from: "customer", text: "Buongiorno, settimana scorsa ho pagato ma il servizio non era quello prenotato.", at: ago(20) },
        { id: "m2", from: "agent", text: "Mi dispiace molto, Luca. Passo subito la tua richiesta al titolare, ti risponderà a breve.", at: ago(18) },
        { id: "m3", from: "owner", text: "Ciao Luca, sono Davide. Mi racconti cosa è successo?", at: ago(2) },
      ],
    },
    {
      id: "c3",
      customer: "Chiara Moretti",
      phone: "+39 329 •••• 663",
      state: "handling",
      intent: "Question · prices",
      language: "Italian",
      updatedAt: ago(1),
      messages: [
        { id: "m1", from: "customer", text: "", at: ago(2), voice: { seconds: 14 } },
        { id: "m2", from: "agent", text: "Ciao Chiara! La piega costa 25 €, con trattamento 35 €. Vuoi che ti cerchi un orario?", at: ago(1) },
      ],
    },
    {
      id: "c4",
      customer: "James Walker",
      phone: "+44 7700 •••• 21",
      state: "handling",
      intent: "Reschedule",
      language: "English",
      updatedAt: ago(11),
      messages: [
        { id: "m1", from: "customer", text: "Hi, can I move my Saturday appointment to next week?", at: ago(12) },
        { id: "m2", from: "agent", text: "Hi James, I'm Nina, the salon's AI assistant. Sure — next Tuesday at 10:00 or Wednesday at 16:00 work. Which one?", at: ago(11) },
      ],
    },
    {
      id: "c5",
      customer: "Federica Gallo",
      phone: "+39 338 •••• 947",
      state: "suspended",
      intent: "Agent off for this chat",
      language: "Italian",
      updatedAt: ago(300),
      messages: [
        { id: "m1", from: "customer", text: "Ciao Davide, ci vediamo stasera per la cena?", at: ago(301) },
        { id: "m2", from: "owner", text: "Sì! Alle 20 😊", at: ago(300) },
      ],
    },
  ];

  const workflows: Workflow[] = [
    { id: "w1", builtIn: true, when: "A customer wants to book an appointment", action: "pending_booking", enabled: true, firedThisMonth: 48 },
    { id: "w2", builtIn: true, when: "A customer wants to move or cancel their booking", action: "pending_booking", enabled: true, firedThisMonth: 17 },
    { id: "w3", builtIn: true, when: "A customer asks a general question", action: "send_message", message: "Answer from the business knowledge", enabled: true, firedThisMonth: 131 },
    { id: "w4", builtIn: false, when: "A customer cancels", action: "send_message", message: "Cancellations less than 24 hours before the visit are charged 50%.", enabled: true, firedThisMonth: 6 },
    { id: "w5", builtIn: false, when: "A customer complains about a service", action: "alert_owner", enabled: true, firedThisMonth: 2 },
    { id: "w6", builtIn: false, when: "A customer asks for money back", action: "hand_off", enabled: true, firedThisMonth: 1 },
    { id: "w7", builtIn: false, when: "Someone writes about a personal, non-business topic", action: "suspend_chat", enabled: false, firedThisMonth: 0 },
  ];

  const usage = {
    periodLabel: "1–31 Oct",
    served: { used: 1_842, limit: 2_500 },
    metaFree: { used: 812, limit: 1_000 },
    breakdown: [
      { label: "Inbound", value: 1_030 },
      { label: "Agent replies", value: 812 },
    ],
    // Served messages per day, last 14 days (oldest first).
    daily: [52, 61, 48, 70, 88, 94, 40, 33, 71, 79, 66, 92, 101, 58],
  };

  return { activity, conversations, workflows, usage };
}

export type MockData = ReturnType<typeof buildMockData>;
