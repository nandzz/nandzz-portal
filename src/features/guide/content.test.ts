import { describe, expect, it } from "vitest";
import { translations } from "@/lib/i18n/dictionaries";
import { GUIDE_VISUALS } from "./components/visuals";

describe("guide content", () => {
  const copies = Object.values(translations).map((t) => t.guidePage);

  it("has the same steps in every language", () => {
    for (const copy of copies) expect(copy.steps.map((s) => s.id)).toEqual(translations.en.guidePage.steps.map((s) => s.id));
  });

  it("has a visual for every step", () => {
    for (const step of translations.en.guidePage.steps) expect(GUIDE_VISUALS[step.id]).toBeTypeOf("function");
  });

  it("never uses banned brand words", () => {
    for (const copy of copies) {
      const text = JSON.stringify(copy).toLowerCase();
      for (const word of ["widget", "restaurant", "ristorant", "agent"]) expect(text).not.toContain(word);
    }
  });
});
