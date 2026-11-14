import { describe, expect, it } from "vitest";
import { buildBookingIcs, escapeIcsText, foldIcsLine, googleCalendarUrl, icsUtc } from "./ics";

const event = {
  uid: "abc@nandzz.com",
  startIso: "2026-11-20T09:30:00.000Z",
  endIso: "2026-11-20T10:15:00.000Z",
  title: "Haircut, beard · Studio; Roma",
  location: "Via Roma 1, Milano",
  description: "Manage: https://nandzz.com/booking/tok",
};

describe("ics", () => {
  it("formats UTC timestamps", () => {
    expect(icsUtc("2026-11-20T09:30:00.000Z")).toBe("20261120T093000Z");
    expect(icsUtc("2026-11-20T10:30:00+01:00")).toBe("20261120T093000Z");
  });

  it("escapes TEXT values", () => {
    expect(escapeIcsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const folded = foldIcsLine("SUMMARY:" + "é".repeat(80));
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe("SUMMARY:" + "é".repeat(80));
  });

  it("builds an event with 2h and 1h alerts", () => {
    const ics = buildBookingIcs(event, new Date("2026-11-14T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261120T093000Z\r\n");
    expect(ics).toContain("DTEND:20261120T101500Z\r\n");
    expect(ics).toContain("SUMMARY:Haircut\\, beard · Studio\\; Roma");
    expect(ics).toContain("UID:abc@nandzz.com");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics).toContain("TRIGGER:-PT120M");
    expect(ics).toContain("TRIGGER:-PT60M");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("builds a Google Calendar template link", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261120T093000Z/20261120T101500Z");
    expect(url.searchParams.get("location")).toBe("Via Roma 1, Milano");
  });
});
