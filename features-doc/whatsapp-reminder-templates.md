# WhatsApp booking reminder — Twilio / Meta templates

Copy-paste source for the **booking reminder** template (sent ~4h before the
appointment by `booking-notifications`). One template per supported locale:
`en, pt, fr, es, ja, de, it`. Create each one in **Twilio Console → Messaging →
Content Template Builder**, submit for WhatsApp approval, then paste the
resulting `HX…` Content SID into nandzz-admin `/whatsapp` for that locale.

## Template settings (all locales)

| Setting | Value |
|---|---|
| Content type | `twilio/call-to-action` (body + 2 URL buttons) |
| Category | **Utility** (an appointment reminder; do not pick Marketing) |
| Name | `booking_reminder_<locale>`, e.g. `booking_reminder_en` |
| Button 1 | Visit website, **dynamic** URL `https://nandzz.com/booking/{{5}}` — manage booking |
| Button 2 | Visit website, **dynamic** URL `https://nandzz.com/booking/whatsapp/{{6}}` — message the business |

## Placeholder mapping (same for every locale)

Set this in admin `/whatsapp` for each locale:

| Placeholder | Variable | Sample value (for Meta review) |
|---|---|---|
| `{{1}}` | `customer_first_name` | Alex |
| `{{2}}` | `business` | Bella Hair Studio |
| `{{3}}` | `date_time` | Today at 3:00 PM |
| `{{4}}` | `services` | Haircut (Maria) |
| `{{5}}` | `manage_token` (button 1 URL suffix) | a1b2c3d4 |
| `{{6}}` | `business_whatsapp` (button 2 URL suffix) | a1b2c3d4 |

Why only these: `price` and `staff` are empty for free services / bookings
without staff, and WhatsApp rejects a send with an empty parameter. `services`
already includes the staff name when there is one. `date_time` comes localized
and may start with a capital ("Today at…", "Hoje às…"), so it sits after a
label (`📅 …:`) instead of mid-sentence.

**Message-us button:** `{{6}}` carries the booking's token (WhatsApp only allows
a variable at the *end* of a URL, and the param can't be empty). The Portal
route `/booking/whatsapp/<token>` looks up the business's WhatsApp number
(booking widget → Services settings → "Business WhatsApp number") at click
time and redirects to a `wa.me` chat with a prefilled, localized message about
the booking. If the business hasn't set a number, it falls back to the
manage-booking page, so one template works for every business.

Meta rules respected: the body doesn't start or end with a variable, no two
variables are adjacent, and there is enough fixed text around them.

---

## en — English (`en`)

**Body**
```
Hi {{1}}, this is a friendly reminder of your upcoming appointment at {{2}}.

📅 When: {{3}}
📋 Booking: {{4}}

Please arrive a few minutes early. If you can't make it, you can reschedule or cancel below, or message us on WhatsApp with any questions.

See you soon!
```
**Button 1 text:** `Manage booking`
**Button 2 text:** `Message us`

---

## pt — Português (`pt_BR`)

**Body**
```
Olá {{1}}, este é um lembrete do seu próximo agendamento em {{2}}.

📅 Quando: {{3}}
📋 Agendamento: {{4}}

Por favor, chegue alguns minutos antes. Se não puder comparecer, você pode reagendar ou cancelar abaixo, ou falar conosco no WhatsApp se tiver dúvidas.

Até breve!
```
**Button 1 text:** `Gerenciar agendamento`
**Button 2 text:** `Fale conosco`

> If the audience is mainly Portugal, register it as `pt_PT` and use
> "Gerir marcação" / "Fale connosco" / "o seu próximo agendamento" / "pode
> reagendar ou cancelar abaixo, ou falar connosco no WhatsApp se tiver dúvidas".

---

## fr — Français (`fr`)

**Body**
```
Bonjour {{1}}, petit rappel de votre prochain rendez-vous chez {{2}}.

📅 Quand : {{3}}
📋 Réservation : {{4}}

Merci d'arriver quelques minutes en avance. En cas d'empêchement, vous pouvez modifier ou annuler votre rendez-vous ci-dessous, ou nous écrire sur WhatsApp pour toute question.

À bientôt !
```
**Button 1 text:** `Gérer ma réservation`
**Button 2 text:** `Nous écrire`

---

## es — Español (`es`)

**Body**
```
Hola {{1}}, te recordamos tu próxima cita en {{2}}.

📅 Cuándo: {{3}}
📋 Reserva: {{4}}

Por favor, llega unos minutos antes. Si no puedes asistir, puedes reprogramar o cancelar abajo, o escribirnos por WhatsApp si tienes alguna pregunta.

¡Hasta pronto!
```
**Button 1 text:** `Gestionar reserva`
**Button 2 text:** `Escríbenos`

---

## ja — 日本語 (`ja`)

**Body**
```
{{1}}様、{{2}}でのご予約のリマインダーです。

📅 日時：{{3}}
📋 ご予約内容：{{4}}

数分前にお越しいただけますようお願いいたします。ご都合が悪くなった場合は、下のボタンから日時の変更またはキャンセルが可能です。ご不明な点はWhatsAppでお気軽にお問い合わせください。

ご来店をお待ちしております。
```
**Button 1 text:** `予約を管理`
**Button 2 text:** `メッセージを送る`

---

## de — Deutsch (`de`)

**Body**
```
Hallo {{1}}, kurze Erinnerung an deinen bevorstehenden Termin bei {{2}}.

📅 Wann: {{3}}
📋 Buchung: {{4}}

Bitte sei ein paar Minuten früher da. Falls du verhindert bist, kannst du den Termin unten verschieben oder absagen – bei Fragen schreib uns einfach auf WhatsApp.

Bis bald!
```
**Button 1 text:** `Buchung verwalten`
**Button 2 text:** `Schreib uns`

> Formal ("Sie") variant: "Guten Tag {{1}}, wir möchten Sie an Ihren
> bevorstehenden Termin bei {{2}} erinnern. … Bitte kommen Sie ein paar Minuten
> früher. Falls Sie verhindert sind, können Sie den Termin unten
> verschieben oder absagen – bei Fragen schreiben Sie uns gerne auf WhatsApp.
> Bis bald!" (Button 2: `Schreiben Sie uns`)

---

## it — Italiano (`it`)

**Body**
```
Ciao {{1}}, ti ricordiamo il tuo prossimo appuntamento presso {{2}}.

📅 Quando: {{3}}
📋 Prenotazione: {{4}}

Ti chiediamo di arrivare qualche minuto prima. Se non puoi venire, puoi spostare o annullare l'appuntamento qui sotto, oppure scriverci su WhatsApp per qualsiasi domanda.

A presto!
```
**Button 1 text:** `Gestisci prenotazione`
**Button 2 text:** `Scrivici`

---

## Fallback: text-only variant (no buttons)

If URL buttons are not wanted, use content type `twilio/text`, map `{{5}}` to
`manage_url` instead of `manage_token`, drop `{{6}}`, and replace the last
paragraph with (en shown; translate the same way as above):

```
Need to reschedule or cancel? Manage your booking here: {{5}}

See you soon!
```

## After approval

1. Admin `/whatsapp` → for each locale paste the `HX…` SID and the mapping above.
2. Use **Test send** (sample vars: Alex / Nandzz Test Studio / Today at 3:00 PM / Haircut (Maria) / `test` / `test`).
3. Turn on **Enabled**. Locales without a template fall back to `en`.
