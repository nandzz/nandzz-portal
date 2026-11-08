import { describe, expect, it } from "vitest";
import { computeUsernameChangeStatus } from "./username-change";

const now = new Date("2026-11-08T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

describe("computeUsernameChangeStatus", () => {
  it("allows 2 changes with no history", () => {
    expect(computeUsernameChangeStatus([], now)).toEqual({ changesLeft: 2, nextChangeAt: null });
  });
  it("ignores changes older than 60 days", () => {
    expect(computeUsernameChangeStatus([daysAgo(61), daysAgo(10)], now).changesLeft).toBe(1);
  });
  it("locks after 2 changes and frees up when the oldest expires", () => {
    const res = computeUsernameChangeStatus([daysAgo(10), daysAgo(40)], now);
    expect(res.changesLeft).toBe(0);
    expect(res.nextChangeAt).toBe(new Date(now.getTime() + 20 * 86_400_000).toISOString());
  });
});
