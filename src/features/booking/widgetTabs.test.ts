import { describe, expect, it } from "vitest";
import { segmentFromTab, tabFromSegment, WIDGET_TABS } from "./widgetTabs";

describe("widgetTabs", () => {
  it("opens the Today tab at the base path and lists it first", () => {
    expect(tabFromSegment(undefined)).toBe("today");
    expect(tabFromSegment("today")).toBe("today");
    expect(WIDGET_TABS[0].tab).toBe("today");
  });

  it("keeps the overview at /dashboard and other tabs 1:1", () => {
    expect(tabFromSegment("dashboard")).toBe("overview");
    expect(segmentFromTab("overview")).toBe("dashboard");
    expect(tabFromSegment("bookings")).toBe("bookings");
    expect(segmentFromTab("services")).toBe("services");
  });

  it("rejects unknown segments and falls back to Today for unknown tabs", () => {
    expect(tabFromSegment("nope")).toBeNull();
    expect(segmentFromTab("nope")).toBe("today");
  });
});
