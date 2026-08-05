// Maps the typed errors raised by the create_booking_tx RPC to HTTP responses
// with visitor-friendly copy. The RPC raises `raise exception 'CODE'`, which
// surfaces as the Postgres error message through supabase-js.

export const BOOKING_ERROR_MAP: Record<string, { status: number; message: string }> = {
  WIDGET_UNAVAILABLE: { status: 404, message: "This booking widget isn't available." },
  NO_ACCESS: { status: 402, message: "This booking widget isn't active right now." },
  INVALID_SERVICE: { status: 400, message: "That service is no longer offered." },
  MISSING_CUSTOMER: { status: 400, message: "Your name and email are required." },
  BLACKOUT: { status: 409, message: "That date is unavailable. Please pick another." },
  OUT_OF_HOURS: { status: 409, message: "That time is outside available hours." },
  STAFF_UNAVAILABLE: { status: 409, message: "That staff member isn't available then. Please pick another." },
  SLOT_TAKEN: { status: 409, message: "That slot was just booked. Please pick another." },
};

export function mapBookingError(message: string | undefined): { status: number; message: string } {
  for (const code of Object.keys(BOOKING_ERROR_MAP)) {
    if (message?.includes(code)) return BOOKING_ERROR_MAP[code];
  }
  return { status: 500, message: "Could not complete the booking. Please try again." };
}
