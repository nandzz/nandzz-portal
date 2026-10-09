import { describe, expect, it } from "vitest";
import { buildAccountExport, EXPORT_SOURCES } from "./export";

describe("buildAccountExport", () => {
  const now = new Date("2026-10-06T12:00:00Z");

  it("unwraps the profile row and keeps other tables under data", () => {
    const out = buildAccountExport({
      user: { id: "u1", email: "a@b.c" },
      tables: { profile: [{ id: "u1", username: "ann" }], spaces: [{ id: "s1" }] },
      now,
    });
    expect(out.generated_at).toBe("2026-10-06T12:00:00.000Z");
    expect(out.account).toEqual({ id: "u1", email: "a@b.c" });
    expect(out.profile).toEqual({ id: "u1", username: "ann" });
    expect(out.data).toEqual({ spaces: [{ id: "s1" }] });
  });

  it("strips capability tokens at any depth", () => {
    const out = buildAccountExport({
      user: {},
      tables: {
        profile: [],
        bookings_received: [{ id: "b1", manage_token: "secret", meta: { access_token: "x", ok: 1 } }],
      },
      now,
    });
    expect(out.profile).toBeNull();
    expect(out.data).toEqual({ bookings_received: [{ id: "b1", meta: { ok: 1 } }] });
  });

  it("has a unique key per source", () => {
    const keys = EXPORT_SOURCES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
