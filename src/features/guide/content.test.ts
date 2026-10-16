import { describe, expect, it } from "vitest";
import { GUIDE_COPY } from "./content";
import { GUIDE_VISUALS } from "./components/visuals";

describe("guide content", () => {
  it("has the same steps in English and Italian", () => {
    expect(GUIDE_COPY.it.steps.map((s) => s.id)).toEqual(GUIDE_COPY.en.steps.map((s) => s.id));
  });

  it("has a visual for every step", () => {
    for (const step of GUIDE_COPY.en.steps) expect(GUIDE_VISUALS[step.id]).toBeTypeOf("function");
  });

  it("never uses banned brand words", () => {
    for (const copy of Object.values(GUIDE_COPY)) {
      const text = JSON.stringify(copy).toLowerCase();
      for (const word of ["widget", "restaurant", "ristorant", "agent"]) expect(text).not.toContain(word);
    }
  });
});
