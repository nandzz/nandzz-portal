import { describe, expect, it } from "vitest";
import { contentReportSchema } from "./schemas";

const base = {
  url: "https://nandzz.com/someone",
  reason: "fraud" as const,
  details: "This page is impersonating my business.",
  goodFaith: true as const,
};

describe("contentReportSchema", () => {
  it("accepts an anonymous notice", () => {
    expect(contentReportSchema.safeParse(base).success).toBe(true);
  });

  it("accepts empty optional contact fields", () => {
    expect(contentReportSchema.safeParse({ ...base, name: "", email: "" }).success).toBe(true);
  });

  it("requires the good-faith statement", () => {
    expect(contentReportSchema.safeParse({ ...base, goodFaith: false }).success).toBe(false);
  });

  it("rejects non-http URLs", () => {
    expect(contentReportSchema.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false);
    expect(contentReportSchema.safeParse({ ...base, url: "not a url" }).success).toBe(false);
  });

  it("rejects too-short explanations and invalid emails", () => {
    expect(contentReportSchema.safeParse({ ...base, details: "bad" }).success).toBe(false);
    expect(contentReportSchema.safeParse({ ...base, email: "nope" }).success).toBe(false);
  });

  it("rejects unknown reasons", () => {
    expect(contentReportSchema.safeParse({ ...base, reason: "spam" }).success).toBe(false);
  });
});
