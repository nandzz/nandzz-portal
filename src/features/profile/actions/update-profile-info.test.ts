import { describe, it, expect, vi, beforeEach } from "vitest";

let mockUser: { id: string } | null;
let updateResult: { error: { message: string } | null };
let updatePayload: Record<string, unknown> | null;
let updateFilter: { column: string; value: unknown } | null;

function builder() {
  const b: Record<string, unknown> = {};
  b.update = (payload: Record<string, unknown>) => {
    updatePayload = payload;
    return b;
  };
  b.eq = (column: string, value: unknown) => {
    updateFilter = { column, value };
    return b;
  };
  b.select = () => b;
  b.single = () =>
    Promise.resolve({ data: updateResult.error ? null : { username: "ada" }, ...updateResult });
  return b;
}

const revalidated: string[] = [];
vi.mock("../revalidate", () => ({
  revalidatePublicProfile: (u: string) => revalidated.push(u),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
    from: () => builder(),
  }),
}));

import { updateProfileInfo } from "./update-profile-info";

const valid = {
  displayName: "Ada",
  tagline: "builder",
  bio: "hi",
  websiteUrl: "https://ada.dev",
  socialLinks: { github: "ada" },
  address: null,
};

beforeEach(() => {
  mockUser = { id: "user_1" };
  updateResult = { error: null };
  updatePayload = null;
  updateFilter = null;
});

describe("updateProfileInfo", () => {
  it("rejects over-long input as INVALID_INPUT", async () => {
    const res = await updateProfileInfo({ ...valid, displayName: "x".repeat(51) });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("returns UNAUTHENTICATED without a user", async () => {
    mockUser = null;
    const res = await updateProfileInfo(valid);
    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("writes the mapped columns scoped to the caller's id", async () => {
    const res = await updateProfileInfo(valid);
    expect(res).toEqual({ ok: true });
    expect(updatePayload).toEqual({
      display_name: "Ada",
      tagline: "builder",
      bio: "hi",
      website_url: "https://ada.dev",
      social_links: { github: "ada" },
      address: null,
    });
    expect(updateFilter).toEqual({ column: "id", value: "user_1" });
    expect(revalidated).toContain("ada");
  });

  it("rejects a social URL pointing at another site", async () => {
    const res = await updateProfileInfo({
      ...valid,
      socialLinks: { instagram: "https://evil.example/login" },
    });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("rejects a website without http(s)", async () => {
    const res = await updateProfileInfo({ ...valid, websiteUrl: "javascript:alert(1)" });
    expect(res).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("surfaces a DB error as FAILED", async () => {
    updateResult = { error: { message: "boom" } };
    const res = await updateProfileInfo(valid);
    expect(res).toEqual({ ok: false, error: "FAILED", message: "boom" });
  });
});
