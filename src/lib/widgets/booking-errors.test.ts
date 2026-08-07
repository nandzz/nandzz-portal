import { describe, it, expect } from "vitest";
import { mapBookingError, BOOKING_ERROR_STATUS, BOOKING_ERROR_KEYS } from "./booking-errors";

describe("mapBookingError", () => {
  it("maps a known code embedded in the RPC's error message", () => {
    expect(mapBookingError("error: SLOT_TAKEN")).toEqual({ status: 409, code: "SLOT_TAKEN" });
  });

  it("maps every known code to its declared status", () => {
    for (const code of Object.keys(BOOKING_ERROR_STATUS)) {
      expect(mapBookingError(code)).toEqual({ status: BOOKING_ERROR_STATUS[code], code });
    }
  });

  it("falls back to a generic 500 for an unrecognized message", () => {
    expect(mapBookingError("something else went wrong")).toEqual({ status: 500, code: "GENERIC" });
  });

  it("falls back to a generic 500 when the message is undefined", () => {
    expect(mapBookingError(undefined)).toEqual({ status: 500, code: "GENERIC" });
  });

  it("every declared status code has a matching i18n key", () => {
    for (const code of Object.keys(BOOKING_ERROR_STATUS)) {
      expect(BOOKING_ERROR_KEYS[code]).toBeTruthy();
    }
  });
});
