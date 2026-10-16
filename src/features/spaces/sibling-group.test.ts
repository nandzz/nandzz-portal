import { describe, expect, it } from "vitest";
import { siblingGroup } from "./sibling-group";

describe("siblingGroup", () => {
  it("maps images to the gallery", () => {
    expect(siblingGroup("image")).toBe("gallery");
  });

  it("maps informative types to publications", () => {
    for (const t of ["html", "pdf", "markdown"]) expect(siblingGroup(t)).toBe("publications");
  });

  it("gives links, videos and untyped spaces no section", () => {
    expect(siblingGroup("link")).toBeNull();
    expect(siblingGroup("video")).toBeNull();
    expect(siblingGroup(null)).toBeNull();
  });
});
