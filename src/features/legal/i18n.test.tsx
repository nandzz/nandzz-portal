import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SUPPORTED_LOCALES } from "@/lib/i18n/translations";
import { fill, getLegalUi } from "./i18n";

describe("legal UI strings", () => {
  it("exist for every app locale and keep their placeholders", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const ui = getLegalUi(locale);
      expect(ui.signupNotice).toContain("{terms}");
      expect(ui.signupNotice).toContain("{privacy}");
      expect(ui.signupNotice).toContain("{age}");
      expect(ui.bookingNotice).toContain("{business}");
      expect(ui.bookingNotice).toContain("{privacy}");
      expect(ui.bannerBody).toContain("{terms}");
    }
  });
});

describe("fill", () => {
  it("substitutes known tokens and leaves the rest of the text", () => {
    const html = renderToStaticMarkup(<>{fill("A {x} B {y}", { x: <b>1</b> })}</>);
    expect(html).toBe("A <b>1</b> B {y}");
  });
});
