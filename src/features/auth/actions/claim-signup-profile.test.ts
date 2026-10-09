import { describe, it, expect, vi, beforeEach } from "vitest";

let mockUser: { id: string } | null;
let rpcResult: { error: { message: string } | null };
let rpcName: string | null;
let rpcArgs: Record<string, unknown> | null;
let rpcCalls: string[];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcCalls.push(name);
      // Track the profile claim itself; the follow-up terms acceptance is
      // asserted separately via rpcCalls.
      if (name === "claim_signup_profile") {
        rpcName = name;
        rpcArgs = args;
        return Promise.resolve(rpcResult);
      }
      return Promise.resolve({ error: null });
    },
  }),
}));

import { claimSignupProfile } from "./claim-signup-profile";

beforeEach(() => {
  mockUser = { id: "user_1" };
  rpcResult = { error: null };
  rpcName = null;
  rpcArgs = null;
  rpcCalls = [];
});

describe("claimSignupProfile", () => {
  it("rejects an invalid username without hitting the RPC", async () => {
    const res = await claimSignupProfile({ username: "ab", displayName: null });
    expect(res).toEqual({ ok: false, error: "INVALID_USERNAME" });
    expect(rpcName).toBeNull();
  });

  it("rejects a username with invalid characters", async () => {
    const res = await claimSignupProfile({
      username: "Bad User!",
      displayName: null,
    });
    expect(res).toEqual({ ok: false, error: "INVALID_USERNAME" });
    expect(rpcName).toBeNull();
  });

  it("returns UNAUTHENTICATED without a user", async () => {
    mockUser = null;
    const res = await claimSignupProfile({
      username: "johndoe",
      displayName: "John",
    });
    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(rpcName).toBeNull();
  });

  it("calls claim_signup_profile with mapped args and returns ok", async () => {
    const res = await claimSignupProfile({
      username: "john_doe-1",
      displayName: "John Doe",
    });
    expect(res).toEqual({ ok: true });
    expect(rpcName).toBe("claim_signup_profile");
    expect(rpcArgs).toEqual({
      p_username: "john_doe-1",
      p_display_name: "John Doe",
    });
  });

  it("records acceptance of the current Terms after a successful claim", async () => {
    await claimSignupProfile({ username: "johndoe", displayName: null });
    expect(rpcCalls).toEqual(["claim_signup_profile", "accept_legal_terms"]);
  });

  it("does not record acceptance when the claim fails", async () => {
    rpcResult = { error: { message: "USERNAME_TAKEN" } };
    await claimSignupProfile({ username: "taken", displayName: null });
    expect(rpcCalls).toEqual(["claim_signup_profile"]);
  });

  it("passes a null display name through", async () => {
    await claimSignupProfile({ username: "johndoe", displayName: null });
    expect(rpcArgs).toEqual({
      p_username: "johndoe",
      p_display_name: null,
    });
  });

  it("maps a USERNAME_TAKEN RPC error", async () => {
    rpcResult = { error: { message: "USERNAME_TAKEN: already exists" } };
    const res = await claimSignupProfile({
      username: "taken",
      displayName: null,
    });
    expect(res).toEqual({ ok: false, error: "USERNAME_TAKEN" });
  });

  it("maps an INVALID_USERNAME RPC error", async () => {
    rpcResult = { error: { message: "INVALID_USERNAME: reserved" } };
    const res = await claimSignupProfile({
      username: "system",
      displayName: null,
    });
    expect(res).toEqual({ ok: false, error: "INVALID_USERNAME" });
  });

  it("surfaces any other RPC error as FAILED", async () => {
    rpcResult = { error: { message: "boom" } };
    const res = await claimSignupProfile({
      username: "johndoe",
      displayName: null,
    });
    expect(res).toEqual({ ok: false, error: "FAILED", message: "boom" });
  });
});
