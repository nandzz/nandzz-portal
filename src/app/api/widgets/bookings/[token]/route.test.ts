import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, DELETE, PATCH } from "./route";
import type { CalendarConfig, WidgetBooking } from "@/lib/types";

const mockLoadMaybeSingle = vi.fn();
const mockUpdateStatusResult = vi.fn();
const mockOthersResult = vi.fn();
const mockRescheduleUpdateResults: { data: unknown; error: unknown }[] = [];
let rescheduleCallIndex = 0;
const mockDispatch = vi.fn();

// `widget_bookings` is queried three shapes in this route:
//  1. loadBooking: select(...).eq("manage_token", token).maybeSingle()
//  2. DELETE: update({status:"cancelled"}).eq("manage_token", token)              -> {error}
//  3. PATCH "others": select(...).eq().eq().neq() [+ .eq/.is location]           -> {data}
//  4. PATCH update loop: update({...}).eq().eq().select().maybeSingle()          -> {data, error}
// We branch on which method chain is entered by tagging the builder per call.
function chainable(terminal: () => unknown) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const m of ["select", "eq", "neq", "gte", "lte", "is", "update"]) builder[m] = chain;
  builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(terminal()).then(resolve, reject);
  builder.maybeSingle = () => Promise.resolve(terminal());
  return builder;
}

const mockFrom = vi.fn(() => ({
  select: (sel: string) => {
    if (typeof sel === "string" && sel.includes("instance:widget_instances")) {
      // loadBooking's shape: select(...).eq("manage_token", token).maybeSingle()
      return { eq: () => ({ maybeSingle: mockLoadMaybeSingle }) };
    }
    // The PATCH "others" query: select(...).eq().eq().neq()[.eq/.is]
    return chainable(mockOthersResult);
  },
  update: (patch: Record<string, unknown>) => {
    if ("status" in patch && patch.status === "cancelled") {
      // DELETE: update(...).eq("manage_token", token) -> {error}
      return { eq: () => Promise.resolve(mockUpdateStatusResult()) };
    }
    // PATCH reschedule: update(...).eq().eq().select().maybeSingle()
    return {
      eq: () => ({
        eq: () => ({
          select: () => ({
            maybeSingle: () => Promise.resolve(mockRescheduleUpdateResults[rescheduleCallIndex++]),
          }),
        }),
      }),
    };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

vi.mock("@/lib/widgets/notify", () => ({
  dispatchBookingMessage: (...args: unknown[]) => mockDispatch(...args),
}));

function params(token = "tok_1") {
  return { params: Promise.resolve({ token }) };
}

function patchReq(body: unknown) {
  return new Request("http://localhost/api/widgets/bookings/tok_1", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof PATCH>[0];
}

const config: CalendarConfig = {
  timezone: "UTC",
  buffer_min: 0,
  show_prices: true,
  locations: [],
  services: [{ id: "svc_1", name: "Haircut", duration_min: 30 }],
  availability: { mon: [["09:00", "17:00"]], tue: [["09:00", "17:00"]] },
  blackout_dates: [],
  staff: [],
  messages: {
    confirmation: { channel: "off", subject: "", body: "" },
    cancellation: { channel: "both", subject: "Cancelled", body: "Sorry {{customer_first_name}}" },
  },
};

function booking(overrides: Partial<WidgetBooking> = {}): WidgetBooking {
  return {
    id: "bkg_1",
    instance_id: "inst_1",
    owner_user_id: "user_1",
    service_id: "svc_1",
    service_name: "Haircut",
    duration_min: 30,
    price_cents: 4000,
    staff_id: null,
    staff_name: null,
    location_id: null,
    location_name: null,
    starts_at: "2026-08-10T09:00:00.000Z",
    ends_at: "2026-08-10T09:30:00.000Z",
    customer_name: "Jamie Rivera",
    customer_email: "jamie@example.com",
    customer_phone: "+15551234567",
    notes: null,
    status: "confirmed",
    manage_token: "tok_1",
    created_by_user_id: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function loadRow(bookingOverrides: Partial<WidgetBooking> = {}, instanceOverrides: Record<string, unknown> = {}) {
  return {
    ...booking(bookingOverrides),
    instance: {
      config,
      enabled: true,
      owner: { display_name: "Acme", username: "acme" },
      catalog: { currency: "usd" },
      ...instanceOverrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rescheduleCallIndex = 0;
  mockRescheduleUpdateResults.length = 0;
  mockOthersResult.mockReturnValue({ data: [] });
});

describe("GET /api/widgets/bookings/[token]", () => {
  it("404s when the token doesn't match any booking", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: null });
    const res = await GET(new Request("http://x") as never, params());
    expect(res.status).toBe(404);
  });

  it("presents the booking with the business name and resolved timezone", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    const res = await GET(new Request("http://x") as never, params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.business_name).toBe("Acme");
    expect(body.timezone).toBe("UTC");
    expect(body.status).toBe("confirmed");
  });

  it("falls back to the username when display_name is unset", async () => {
    mockLoadMaybeSingle.mockResolvedValue({
      data: loadRow({}, { owner: { display_name: "", username: "acme_user" } }),
    });
    const res = await GET(new Request("http://x") as never, params());
    const body = await res.json();
    expect(body.business_name).toBe("acme_user");
  });
});

describe("DELETE /api/widgets/bookings/[token]", () => {
  it("404s when the token doesn't match any booking", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: null });
    const res = await DELETE(new Request("http://x") as never, params());
    expect(res.status).toBe(404);
  });

  it("cancels the booking and sends a cancellation message on first cancel", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow({ status: "confirmed" }) });
    mockUpdateStatusResult.mockReturnValue({ error: null });

    const res = await DELETE(new Request("http://x") as never, params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, status: "cancelled" });
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it("does not re-send the cancellation message on a double-cancel", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow({ status: "cancelled" }) });
    mockUpdateStatusResult.mockReturnValue({ error: null });

    const res = await DELETE(new Request("http://x") as never, params());

    expect(res.status).toBe(200);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("500s with the DB error message when the update fails", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    mockUpdateStatusResult.mockReturnValue({ error: { message: "db exploded" } });

    const res = await DELETE(new Request("http://x") as never, params());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("db exploded");
  });
});

describe("PATCH /api/widgets/bookings/[token] (reschedule)", () => {
  it("400s when starts_at is missing", async () => {
    const res = await PATCH(patchReq({}), params());
    expect(res.status).toBe(400);
  });

  it("404s when the token doesn't match any booking", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: null });
    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    expect(res.status).toBe(404);
  });

  it("409s when the booking is already cancelled", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow({ status: "cancelled" }) });
    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    expect(res.status).toBe(409);
  });

  it("409s when the widget instance is disabled", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow({}, { enabled: false }) });
    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    expect(res.status).toBe(409);
  });

  it("409s when the service no longer exists on the config", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow({ service_id: "svc_removed" }) });
    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    expect(res.status).toBe(409);
  });

  it("409s when the requested time isn't an open slot", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    // Tuesday 03:00 UTC is outside the 09:00-17:00 window.
    const res = await PATCH(patchReq({ starts_at: "2026-08-11T03:00:00.000Z" }), params());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("That time isn't available.");
  });

  it("reschedules to a valid slot and returns the new time", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    mockRescheduleUpdateResults.push({
      data: { starts_at: "2026-08-11T09:00:00.000Z", ends_at: "2026-08-11T09:30:00.000Z", staff_id: null, staff_name: null },
      error: null,
    });

    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, starts_at: "2026-08-11T09:00:00.000Z" });
  });

  it("409s with 'just taken' when every update attempt hits the exclusion constraint", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    mockRescheduleUpdateResults.push({ data: null, error: { code: "23P01" } });

    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe("That slot was just taken. Please pick another.");
  });

  it("500s on a non-clash update failure without retrying", async () => {
    mockLoadMaybeSingle.mockResolvedValue({ data: loadRow() });
    mockRescheduleUpdateResults.push({ data: null, error: { code: "other" } });

    const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to reschedule.");
  });

  describe("staff targeting", () => {
    const staffConfig: CalendarConfig = {
      ...config,
      staff: [
        { id: "st_a", name: "Alex", availability: { tue: [["09:00", "17:00"]] } },
        { id: "st_b", name: "Bella", availability: { tue: [["09:00", "17:00"]] } },
      ],
    };

    it("keeps the booking's current staff when staff_id is omitted", async () => {
      mockLoadMaybeSingle.mockResolvedValue({
        data: loadRow({ staff_id: "st_a" }, { config: staffConfig }),
      });
      mockRescheduleUpdateResults.push({
        data: { starts_at: "2026-08-11T09:00:00.000Z", ends_at: "2026-08-11T09:30:00.000Z", staff_id: "st_a", staff_name: "Alex" },
        error: null,
      });

      const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z" }), params());
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.staff_id).toBe("st_a");
    });

    it("409s when the explicitly requested staff isn't free at the target slot", async () => {
      mockLoadMaybeSingle.mockResolvedValue({
        data: loadRow({ staff_id: "st_a" }, { config: staffConfig }),
      });
      // Only st_a is free (st_b has no availability window at all in this config).
      const res = await PATCH(
        patchReq({ starts_at: "2026-08-11T09:00:00.000Z", staff_id: "st_b_missing_from_config" }),
        params()
      );
      const body = await res.json();
      expect(res.status).toBe(409);
      expect(body.error).toBe("That specialist isn't free at that time.");
    });

    it("treats staff_id: '' as any-available and tries each free candidate", async () => {
      mockLoadMaybeSingle.mockResolvedValue({
        data: loadRow({ staff_id: "st_a" }, { config: staffConfig }),
      });
      mockRescheduleUpdateResults.push({
        data: { starts_at: "2026-08-11T09:00:00.000Z", ends_at: "2026-08-11T09:30:00.000Z", staff_id: "st_a", staff_name: "Alex" },
        error: null,
      });

      const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z", staff_id: "" }), params());
      expect(res.status).toBe(200);
    });

    it("falls through to the next candidate when the first hits an exclusion clash", async () => {
      mockLoadMaybeSingle.mockResolvedValue({
        data: loadRow({ staff_id: "st_a" }, { config: staffConfig }),
      });
      mockRescheduleUpdateResults.push(
        { data: null, error: { code: "23P01" } },
        {
          data: { starts_at: "2026-08-11T09:00:00.000Z", ends_at: "2026-08-11T09:30:00.000Z", staff_id: "st_b", staff_name: "Bella" },
          error: null,
        }
      );

      const res = await PATCH(patchReq({ starts_at: "2026-08-11T09:00:00.000Z", staff_id: "" }), params());
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.staff_id).toBe("st_b");
    });
  });
});
