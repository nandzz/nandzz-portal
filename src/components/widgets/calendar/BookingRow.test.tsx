import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BookingRow, type BookingRowData } from "./BookingRow";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

function makeBooking(overrides: Partial<BookingRowData> = {}): BookingRowData {
  return {
    id: "bk_1",
    instance_id: "inst_1",
    service_id: "svc_1",
    customer_name: "Jane Doe",
    customer_email: "jane@example.com",
    service_name: "Haircut",
    starts_at: "2026-08-10T09:00:00.000Z",
    price_cents: 5000,
    status: "confirmed",
    customer_phone: null,
    manage_token: "token_123",
    staff_id: null,
    staff_name: null,
    ...overrides,
  };
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const fmt = (iso: string) => iso;

function renderRow(overrides: Partial<BookingRowData> = {}, props: { dim?: boolean; cancellable?: boolean } = {}) {
  const b = makeBooking(overrides);
  return render(
    <BookingRow b={b} money={money} fmt={fmt} timezone="UTC" dim={props.dim} cancellable={props.cancellable} />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BookingRow", () => {
  describe("contact links", () => {
    it("always shows the mailto link", () => {
      renderRow();
      const link = screen.getByRole("link", { name: "Email Jane Doe" });
      expect(link).toHaveAttribute("href", "mailto:jane@example.com");
    });

    it("shows a WhatsApp link when customer_phone is present and dialable", () => {
      renderRow({ customer_phone: "+1 555-123-4567" });
      const link = screen.getByRole("link", { name: "WhatsApp Jane Doe" });
      expect(link).toHaveAttribute("href", expect.stringContaining("https://wa.me/15551234567"));
    });

    it("does not show a WhatsApp link when customer_phone is null", () => {
      renderRow({ customer_phone: null });
      expect(screen.queryByRole("link", { name: "WhatsApp Jane Doe" })).not.toBeInTheDocument();
    });

    it("does not show a WhatsApp link when the phone has too few digits to dial", () => {
      renderRow({ customer_phone: "123" });
      expect(screen.queryByRole("link", { name: "WhatsApp Jane Doe" })).not.toBeInTheDocument();
    });
  });

  describe("status badge", () => {
    it("shows the Cancelled badge for cancelled bookings", () => {
      renderRow({ status: "cancelled" });
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });

    it("does not show the Cancelled badge for confirmed bookings", () => {
      renderRow({ status: "confirmed" });
      expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
    });
  });

  describe("price display", () => {
    it("shows the formatted price when price_cents is set and positive", () => {
      renderRow({ price_cents: 5000 });
      expect(screen.getByText("$50.00")).toBeInTheDocument();
    });

    it("does not show a price when price_cents is null", () => {
      renderRow({ price_cents: null });
      expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
    });

    it("does not show a price when price_cents is 0", () => {
      renderRow({ price_cents: 0 });
      expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
    });
  });

  describe("cancel button visibility", () => {
    it("renders the cancel button when cancellable is true", () => {
      renderRow({}, { cancellable: true });
      expect(screen.getByRole("button", { name: "Cancel Jane Doe's booking" })).toBeInTheDocument();
    });

    it("does not render the cancel button when cancellable is false", () => {
      renderRow({}, { cancellable: false });
      expect(screen.queryByRole("button", { name: "Cancel Jane Doe's booking" })).not.toBeInTheDocument();
    });
  });

  describe("cancelling a booking", () => {
    it("does nothing when the user declines the confirm dialog", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const user = userEvent.setup();

      renderRow({}, { cancellable: true });
      await user.click(screen.getByRole("button", { name: "Cancel Jane Doe's booking" }));

      expect(fetchMock).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("calls the DELETE endpoint with the booking's manage_token and refreshes on success", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
      vi.stubGlobal("fetch", fetchMock);
      const user = userEvent.setup();

      renderRow({ manage_token: "abc-123" }, { cancellable: true });
      await user.click(screen.getByRole("button", { name: "Cancel Jane Doe's booking" }));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith("/api/widgets/bookings/abc-123", { method: "DELETE" })
      );
      await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
      vi.unstubAllGlobals();
    });

    it("shows an alert with the server error and does not refresh when the request fails", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Too late to cancel" }),
      });
      vi.stubGlobal("fetch", fetchMock);
      const user = userEvent.setup();

      renderRow({}, { cancellable: true });
      await user.click(screen.getByRole("button", { name: "Cancel Jane Doe's booking" }));

      await waitFor(() => expect(alertMock).toHaveBeenCalledWith("Too late to cancel"));
      expect(mockRefresh).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("shows a generic alert when fetch throws", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});
      const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
      vi.stubGlobal("fetch", fetchMock);
      const user = userEvent.setup();

      renderRow({}, { cancellable: true });
      await user.click(screen.getByRole("button", { name: "Cancel Jane Doe's booking" }));

      await waitFor(() => expect(alertMock).toHaveBeenCalledWith("Could not cancel this booking."));
      vi.unstubAllGlobals();
    });
  });
});
