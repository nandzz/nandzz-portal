import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSpaceLiked,
  getLikedSpaceIds,
  getSpaceLikesCount,
} from "./social";

// Minimal chainable Supabase stub: every filter method returns the builder, and
// the builder resolves (when awaited or via maybeSingle) to `result`.
function stub(result: unknown, opts: { record?: (m: string, a: unknown[]) => void } = {}) {
  const builder: Record<string, unknown> = {};
  const passthrough =
    (method: string) =>
    (...args: unknown[]) => {
      opts.record?.(method, args);
      return builder;
    };
  for (const m of ["select", "eq", "in"]) builder[m] = passthrough(m);
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  const from = () => builder as unknown;
  return { supabase: { from } as unknown as SupabaseClient, builder };
}

describe("getSpaceLiked", () => {
  it("returns true when a like row exists", async () => {
    const { supabase } = stub({ data: { id: "like_1" } });
    expect(await getSpaceLiked(supabase, "space_1", "user_1")).toBe(true);
  });
  it("returns false when no row", async () => {
    const { supabase } = stub({ data: null });
    expect(await getSpaceLiked(supabase, "space_1", "user_1")).toBe(false);
  });
});

describe("getLikedSpaceIds", () => {
  it("short-circuits to [] and issues no query for empty input", async () => {
    const calls: string[] = [];
    const { supabase } = stub({ data: [] }, { record: (m) => calls.push(m) });
    expect(await getLikedSpaceIds(supabase, "user_1", [])).toEqual([]);
    expect(calls).toEqual([]);
  });
  it("maps rows to space ids", async () => {
    const { supabase } = stub({ data: [{ space_id: "a" }, { space_id: "b" }] });
    expect(await getLikedSpaceIds(supabase, "user_1", ["a", "b", "c"])).toEqual(["a", "b"]);
  });
});

describe("getSpaceLikesCount", () => {
  it("returns the exact count", async () => {
    const { supabase } = stub({ count: 7 });
    expect(await getSpaceLikesCount(supabase, "space_1")).toBe(7);
  });
  it("defaults to 0 when count is null", async () => {
    const { supabase } = stub({ count: null });
    expect(await getSpaceLikesCount(supabase, "space_1")).toBe(0);
  });
});
