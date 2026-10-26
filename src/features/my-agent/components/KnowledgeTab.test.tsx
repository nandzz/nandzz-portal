import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KnowledgeEntry } from "../types";
import { KnowledgeTab } from "./KnowledgeTab";

const mockSave = vi.fn();
const mockDelete = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
vi.mock("../actions/agent-settings", () => ({
  saveKnowledgeEntry: (...a: unknown[]) => mockSave(...a),
  deleteKnowledgeEntry: (...a: unknown[]) => mockDelete(...a),
}));

const NOW = Date.parse("2026-10-26T12:00:00Z");
const entry: KnowledgeEntry = {
  id: "3903cee0-b1f1-48b6-be4a-8bc550f5c114",
  title: "Prices",
  body: "Cut 25 €, with styling 35 €.",
  updatedAt: "2026-10-26T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  // Desktop layout: ResponsivePanel renders a dialog, not the phone sheet.
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  mockSave.mockResolvedValue({ ok: true, id: "new_id" });
  mockDelete.mockResolvedValue({ ok: true });
});

describe("KnowledgeTab", () => {
  it("empty: adds a first entry", async () => {
    const user = userEvent.setup();
    render(<KnowledgeTab entries={[]} now={NOW} />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add your first entry/i }));
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Title"), "Parking");
    await user.type(screen.getByLabelText("Content"), "Free after 18:00");
    await user.click(save);

    await waitFor(() => expect(mockSave).toHaveBeenCalledWith({ title: "Parking", body: "Free after 18:00" }));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("edits an existing entry by id", async () => {
    const user = userEvent.setup();
    render(<KnowledgeTab entries={[entry]} now={NOW} />);
    await user.click(screen.getByRole("button", { name: "Edit Prices" }));
    expect(screen.getByLabelText("Title")).toHaveValue("Prices");
    await user.type(screen.getByLabelText("Content"), " Kids 15 €.");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith({ id: entry.id, title: "Prices", body: `${entry.body} Kids 15 €.` }),
    );
  });

  it("keeps the panel open with a message when the cap is reached", async () => {
    mockSave.mockResolvedValue({ ok: false, error: "TOO_MANY" });
    const user = userEvent.setup();
    render(<KnowledgeTab entries={[entry]} now={NOW} />);
    await user.click(screen.getByRole("button", { name: /add/i }));
    await user.type(screen.getByLabelText("Title"), "A");
    await user.type(screen.getByLabelText("Content"), "B");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("maximum number of entries");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("deletes after confirming", async () => {
    const user = userEvent.setup();
    render(<KnowledgeTab entries={[entry]} now={NOW} />);
    await user.click(screen.getByRole("button", { name: "Delete Prices" }));
    expect(await screen.findByText("Delete this entry?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(entry.id));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
  });

  it("says so when a delete fails", async () => {
    mockDelete.mockResolvedValue({ ok: false, error: "FAILED" });
    const user = userEvent.setup();
    render(<KnowledgeTab entries={[entry]} now={NOW} />);
    await user.click(screen.getByRole("button", { name: "Delete Prices" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't delete");
  });
});
