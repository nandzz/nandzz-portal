import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const DOC_ID = "11111111-1111-4111-8111-111111111111";

let mockUser: { id: string } | null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
  }),
}));

import { embedAgentDocument } from "./embed-agent-document";

beforeEach(() => {
  mockUser = { id: "user_1" };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("embedAgentDocument", () => {
  it("rejects a non-uuid id", async () => {
    expect(await embedAgentDocument("nope")).toEqual({ ok: false, error: "INVALID_INPUT" });
  });

  it("returns UNAUTHENTICATED without a user", async () => {
    mockUser = null;
    expect(await embedAgentDocument(DOC_ID)).toEqual({ ok: false, error: "UNAUTHENTICATED" });
  });

  it("posts the document + user id to the edge function on success", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const res = await embedAgentDocument(DOC_ID);
    expect(res).toEqual({ ok: true });
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/functions/v1/embed-document");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      document_id: DOC_ID,
      user_id: "user_1",
    });
  });

  it("returns FAILED when the edge function is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    const res = await embedAgentDocument(DOC_ID);
    expect(res).toEqual({ ok: false, error: "FAILED", message: "edge 500" });
  });
});
