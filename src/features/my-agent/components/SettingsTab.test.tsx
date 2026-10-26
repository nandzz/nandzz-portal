import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { settingsFromRow } from "../settings";
import { SettingsTab } from "./SettingsTab";

const mockSave = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
vi.mock("../actions/agent-settings", () => ({ saveAgentSettings: (...a: unknown[]) => mockSave(...a) }));

const initial = settingsFromRow({
  enabled: true,
  agent_name: "Nina",
  agent_intro: "",
  autonomy: { new_booking: "pending", reschedule: "pending", cancel: "pending" },
  agent_hours: null,
  takeover_pause_min: 5,
  retention_months: 6,
});

const renderTab = () => render(<SettingsTab initial={initial} businessName="Salone Bella" />);
const saveButton = () => screen.getByRole("button", { name: "Save" });

beforeEach(() => {
  vi.clearAllMocks();
  mockSave.mockResolvedValue({ ok: true });
});

describe("SettingsTab", () => {
  it("previews the default role from the business name", () => {
    renderTab();
    expect(screen.getByText(/I'm Nina, the virtual assistant of Salone Bella/)).toBeInTheDocument();
    expect(screen.getByText("No hours set. The agent tells customers someone will reply soon.")).toBeInTheDocument();
  });

  it("saves the edited settings and refreshes", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Luca ");
    await user.click(screen.getAllByRole("radio", { name: "Confirm" })[0]);
    await user.click(saveButton());

    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave.mock.calls[0][0]).toMatchObject({
      name: "Luca ",
      autonomy: { new_booking: "confirm", reschedule: "pending", cancel: "pending" },
    });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    // Saved state mirrors the stored (trimmed) values, so nothing is unsaved.
    expect(screen.getByLabelText("Name")).toHaveValue("Luca");
  });

  it("blocks saving an empty name or a day that ends before it starts", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.clear(screen.getByLabelText("Name"));
    expect(saveButton()).toBeDisabled();
    await user.type(screen.getByLabelText("Name"), "Nina2");

    await user.click(screen.getByRole("switch", { name: "Set hours" }));
    const from = screen.getByLabelText("Mon from");
    await user.clear(from);
    await user.type(from, "20:00");
    expect(screen.getByText("Each day must end after it starts.")).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
  });

  it("shows the error and keeps the changes when saving fails", async () => {
    mockSave.mockResolvedValue({ ok: false, error: "FAILED" });
    const user = userEvent.setup();
    renderTab();
    await user.type(screen.getByLabelText("Name"), "x");
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save");
    expect(screen.getByLabelText("Name")).toHaveValue("Ninax");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("discard restores the saved values", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.type(screen.getByLabelText("Name"), "x");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Nina");
  });
});
