import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import type { CalendarConfig } from "@/lib/types";

const mockBookingMaybeSingle = vi.fn();
const mockOwnSegments = vi.fn<() => { data: unknown[] }>(() => ({ data: [] }));
const mockBusy = vi.fn<() => { data: unknown[] }>(() => ({ data: [] }));
const mockGetUser = vi.fn(async () => ({ data: { user: { id: "owner_1" } } }));

// widget_booking_segments is queried two ways:
//  - own segments: select().eq().eq().order()  -> mockOwnSegments
//  - busy:         select().eq().eq().neq().gte().lte()[.eq/.is] (awaited) -> mockBusy
function segmentsBuilder(): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "gte", "lte", "is"]) b[m] = () => b;
  b.order = () => ({
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(mockOwnSegments()).then(res, rej),
  });
  b.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(mockBusy()).then(res, rej);
  return b;
}

const mockFrom = vi.fn((table: string) => {
  if (table === "widget_booking_segments") return segmentsBuilder();
  return { select: () => ({ eq: () => ({ maybeSingle: mockBookingMaybeSingle }) }) };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mockFrom }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

function params(token = "tok_1") {
  return { params: Promise.resolve({ token }) };
}
function req() {
  return new Request("http://localhost/api/widgets/bookings/tok_1/staff-options") as never;
}

const config: CalendarConfig = {
  timezone: "UTC",
  currency: "eur",
  buffer_min: 0,
  show_prices: true,
  collect_address: false,
  address_required: false,
  locations: [],
  services: [{ id: "svc_1", name: "Nails", duration_min: 30, staff_ids: ["st_a"] }],
  availability: { mon: [["09:00", "17:00"]] },
  blackout_dates: [],
  staff: [
    { id: "st_a", name: "Felipe", availability: { mon: [["09:00", "17:00"]] } },
    { id: "st_b", name: "Anny Natalia", availability: { mon: [["09:00", "17:00"]] } },
  ],
  messages: {
    confirmation: { channel: "off", subject: "", body: "" },
    cancellation: { channel: "off", subject: "", body: "" },
    reschedule: { channel: "off", subject: "", body: "" },
    reminder: { channel: "off", subject: "", body: "" },
  },
};

function bookingRow(overrides = {}) {
  return {
    id: "bkg_1",
    owner_user_id: "owner_1",
    status: "confirmed",
    instance_id: "inst_1",
    location_id: null,
    instance: { config },
    ...overrides,
  };
}

const ownSegment = {
  service_id: "svc_1",
  service_name: "Nails",
  duration_min: 30,
  price_cents: null,
  parallel: false,
  seq: 0,
  staff_id: "st_a",
  starts_at: "2026-08-10T10:00:00.000Z",
  ends_at: "2026-08-10T10:30:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "owner_1" } } });
  mockBookingMaybeSingle.mockResolvedValue({ data: bookingRow() });
  mockOwnSegments.mockReturnValue({ data: [ownSegment] });
  mockBusy.mockReturnValue({ data: [] });
});

describe("GET /api/widgets/bookings/[token]/staff-options", () => {
  it("404s when the token doesn't match a booking", async () => {
    mockBookingMaybeSingle.mockResolvedValue({ data: null });
    const res = await GET(req(), params());
    expect(res.status).toBe(404);
  });

  it("403s when the caller isn't the owner", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "someone_else" } } });
    const res = await GET(req(), params());
    expect(res.status).toBe(403);
  });

  it("lists EVERY in-scope staff member per service, marking eligibility", async () => {
    const res = await GET(req(), params());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.services).toHaveLength(1);
    const svc = body.services[0];
    expect(svc.service_id).toBe("svc_1");
    expect(svc.current_staff_id).toBe("st_a");
    // Both staff appear even though only Felipe is eligible for Nails.
    expect(svc.options.map((o: { id: string }) => o.id)).toEqual(["st_a", "st_b"]);
    const felipe = svc.options.find((o: { id: string }) => o.id === "st_a");
    const anny = svc.options.find((o: { id: string }) => o.id === "st_b");
    expect(felipe).toMatchObject({ eligible: true, working: true, assignable: true, is_current: true });
    expect(anny).toMatchObject({ eligible: false, is_current: false });
  });

  it("reports WHO a busy staff member is busy with (conflicting booking meta)", async () => {
    mockBusy.mockReturnValue({
      data: [
        {
          staff_id: "st_b",
          starts_at: "2026-08-10T10:15:00.000Z",
          ends_at: "2026-08-10T10:45:00.000Z",
          service_name: "Color",
          booking: { customer_name: "Dana Kim" },
        },
      ],
    });

    const res = await GET(req(), params());
    const body = await res.json();
    const anny = body.services[0].options.find((o: { id: string }) => o.id === "st_b");
    expect(anny.assignable).toBe(false);
    expect(anny.busy_with).toMatchObject({ customer_name: "Dana Kim", service_name: "Color" });
  });

  it("returns an empty roster for an unstaffed business", async () => {
    mockBookingMaybeSingle.mockResolvedValue({
      data: bookingRow({ instance: { config: { ...config, staff: [] } } }),
    });
    const res = await GET(req(), params());
    const body = await res.json();
    expect(body.services).toEqual([]);
  });
});
