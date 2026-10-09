import { describe, expect, it } from "vitest";
import { formatLegalDate, toLegalLocale } from "./locale";

describe("toLegalLocale", () => {
  it("keeps Italian", () => {
    expect(toLegalLocale("it")).toBe("it");
  });

  it("falls back to English for every other locale", () => {
    for (const l of ["en", "pt", "fr", "es", "ja", "de", undefined, null, "xx"]) {
      expect(toLegalLocale(l)).toBe("en");
    }
  });
});

describe("formatLegalDate", () => {
  it("formats in the document language without timezone drift", () => {
    expect(formatLegalDate("2026-10-06", "en")).toBe("6 October 2026");
    expect(formatLegalDate("2026-10-06", "it")).toBe("6 ottobre 2026");
  });
});
