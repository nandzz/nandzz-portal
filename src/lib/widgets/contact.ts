// Customer-contact helpers shared by the owner dashboard views. Pure, no I/O —
// safe in client components.

// Build a wa.me deep link (E.164 digits only) with a prefilled message.
// Returns null when the phone isn't a dialable number.
export function whatsappLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
