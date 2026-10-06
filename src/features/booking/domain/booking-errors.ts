// Maps the typed errors raised by the create_booking_tx RPC to an HTTP status
// and a translation key. The RPC raises `raise exception 'CODE'`, which
// surfaces as the Postgres error message through supabase-js. The API stays
// locale-agnostic — it returns the code, and the client renders the
// visitor-friendly copy from the `booking` i18n namespace in their language.

export const BOOKING_ERROR_STATUS: Record<string, number> = {
  WIDGET_UNAVAILABLE: 404,
  NO_ACCESS: 402,
  INVALID_SERVICE: 400,
  INVALID_LOCATION: 400,
  MISSING_CUSTOMER: 400,
  BLACKOUT: 409,
  OUT_OF_HOURS: 409,
  STAFF_UNAVAILABLE: 409,
  SLOT_TAKEN: 409,
};

// Keys into the `booking` namespace of Translations (src/lib/i18n/translations.ts).
export const BOOKING_ERROR_KEYS: Record<string, string> = {
  WIDGET_UNAVAILABLE: "errorWidgetUnavailable",
  NO_ACCESS: "errorNoAccess",
  INVALID_SERVICE: "errorInvalidService",
  INVALID_LOCATION: "errorInvalidLocation",
  MISSING_CUSTOMER: "errorMissingCustomer",
  BLACKOUT: "errorBlackout",
  OUT_OF_HOURS: "errorOutOfHours",
  STAFF_UNAVAILABLE: "errorStaffUnavailable",
  SLOT_TAKEN: "errorSlotTaken",
};

export function mapBookingError(message: string | undefined): { status: number; code: string } {
  for (const code of Object.keys(BOOKING_ERROR_STATUS)) {
    if (message?.includes(code)) return { status: BOOKING_ERROR_STATUS[code], code };
  }
  return { status: 500, code: "GENERIC" };
}
