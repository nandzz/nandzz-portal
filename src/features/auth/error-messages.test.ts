import { describe, it, expect } from "vitest";
import { mapAuthError } from "./error-messages";
import { translations } from "@/lib/i18n/dictionaries";

const t = translations.en;

describe("mapAuthError", () => {
  it("maps rate-limit messages (the reported bug) to localized copy", () => {
    expect(mapAuthError("email rate limit exceeded", t)).toBe(t.authErrors.rateLimit);
    expect(
      mapAuthError("For security purposes, you can only request this after 51 seconds", t)
    ).toBe(t.authErrors.rateLimit);
  });

  it("maps invalid credentials", () => {
    expect(mapAuthError("Invalid login credentials", t)).toBe(
      t.authErrors.invalidCredentials
    );
  });

  it("maps an already-registered email", () => {
    expect(mapAuthError("User already registered", t)).toBe(t.authErrors.emailInUse);
  });

  it("maps expired/invalid OTP tokens", () => {
    expect(mapAuthError("Token has expired or is invalid", t)).toBe(
      t.authErrors.otpInvalid
    );
  });

  it("maps network failures", () => {
    expect(mapAuthError("Failed to fetch", t)).toBe(t.authErrors.network);
  });

  it("falls back to generic for unknown or empty messages — never the raw text", () => {
    expect(mapAuthError("some unexpected internal detail", t)).toBe(
      t.authErrors.generic
    );
    expect(mapAuthError("", t)).toBe(t.authErrors.generic);
    expect(mapAuthError(null, t)).toBe(t.authErrors.generic);
    expect(mapAuthError(undefined, t)).toBe(t.authErrors.generic);
  });
});
