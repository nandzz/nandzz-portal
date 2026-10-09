import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LEGAL_CONTENT } from "./index";

describe("legal content", () => {
  for (const [key, byLocale] of Object.entries(LEGAL_CONTENT)) {
    describe(key, () => {
      it("has the same section anchors in English and Italian", () => {
        expect(byLocale.it.sections.map((s) => s.id)).toEqual(byLocale.en.sections.map((s) => s.id));
      });

      it("has unique anchors", () => {
        const ids = byLocale.en.sections.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("renders every section with content in both languages", () => {
        for (const doc of [byLocale.en, byLocale.it]) {
          for (const s of doc.sections) {
            const html = renderToStaticMarkup(<>{s.body}</>);
            expect(html.replace(/<[^>]+>/g, "").trim().length, `${key}#${s.id}`).toBeGreaterThan(20);
          }
        }
      });
    });
  }

  it("links the Privacy Policy anchors used by in-product notices", () => {
    const ids = LEGAL_CONTENT.privacy.en.sections.map((s) => s.id);
    expect(ids).toContain("bookings"); // BookingPrivacyNotice → /privacy#bookings
    expect(ids).toContain("sharing"); // DPA → /privacy#sharing
    expect(LEGAL_CONTENT.terms.en.sections.map((s) => s.id)).toContain("moderation");
  });
});
