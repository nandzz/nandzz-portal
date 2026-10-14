import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyProfile, getFollowList, getPublicImageSpaces } from "./profiles";

// Chainable Supabase stub: filter methods return the builder; the builder
// resolves (awaited, or via single) to `result`. Mirrors the collections tests.
function stub(result: unknown) {
  const builder: Record<string, unknown> = {};
  const pass =
    () =>
    () =>
      builder;
  for (const m of ["select", "eq", "order", "range"]) builder[m] = pass();
  builder.single = () => Promise.resolve(result);
  builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return { supabase: { from: () => builder } as unknown as SupabaseClient };
}

describe("getMyProfile", () => {
  it("returns the row or null", async () => {
    const { supabase } = stub({ data: { id: "u1", username: "a" } });
    expect(await getMyProfile(supabase, "u1")).toEqual({ id: "u1", username: "a" });
    const none = stub({ data: null });
    expect(await getMyProfile(none.supabase, "u1")).toBeNull();
  });
});

describe("getFollowList", () => {
  it("unwraps the FK-hinted embed and drops null joins", async () => {
    const { supabase } = stub({
      data: [
        { profiles: { id: "u1", username: "a", display_name: null, avatar_url: null } },
        { profiles: null },
      ],
    });
    expect(await getFollowList(supabase, "p1", "followers", 0, 19)).toEqual({
      users: [{ id: "u1", username: "a", display_name: null, avatar_url: null }],
      rowCount: 2,
    });
  });

  it("returns [] when there are no rows", async () => {
    const { supabase } = stub({ data: null });
    expect(await getFollowList(supabase, "p1", "following", 0, 19)).toEqual({ users: [], rowCount: 0 });
  });
});

describe("getPublicImageSpaces", () => {
  it("returns the spaces and count", async () => {
    const spaces = [{ id: "s1" }, { id: "s2" }];
    const { supabase } = stub({ data: spaces, count: 5 });
    expect(await getPublicImageSpaces(supabase, "p1", 0, 11)).toEqual({
      spaces,
      count: 5,
    });
  });

  it("normalizes missing data/count", async () => {
    const { supabase } = stub({ data: null, count: null });
    expect(await getPublicImageSpaces(supabase, "p1", 0, 11)).toEqual({
      spaces: [],
      count: null,
    });
  });
});
