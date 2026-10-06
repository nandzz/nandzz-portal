import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "./AuthForm";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignUp = vi.fn();
const mockSignIn = vi.fn();
const mockClaim = vi.fn();

const mockSearchParams = { get: vi.fn().mockReturnValue(null) };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("../auth", () => ({
  signUpWithEmail: (...args: unknown[]) => mockSignUp(...args),
  signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
  signInWithGoogle: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("../actions/claim-signup-profile", () => ({
  claimSignupProfile: (...args: unknown[]) => mockClaim(...args),
}));

// A fresh signup lands on its profile via a full-page navigation
// (window.location.assign); stub it so we can assert on it in jsdom.
const originalLocation = window.location;
beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { assign: vi.fn(), origin: "http://localhost", href: "http://localhost/" },
  });
});
afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: originalLocation,
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  // Signup is two-step: create the account (session immediate), then choose a
  // username. Default the account creation to success with a live session so the
  // form advances to the username ("setup") step.
  mockSignUp.mockResolvedValue({ error: null, hasSession: true });
  mockSignIn.mockResolvedValue({ error: null });
  mockClaim.mockResolvedValue({ ok: true });
});

// Enter signup mode and create the account (email + password), landing on the
// username ("setup") step.
async function reachUsernameStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Sign up" }));
  await user.type(screen.getByLabelText(/email/i), "john@example.com");
  await user.type(screen.getByLabelText("Password"), "password123");
  await user.type(screen.getByLabelText(/confirm password/i), "password123");
  await user.click(screen.getAllByRole("button", { name: "Sign up" })[0]);
  // The setup step's heading confirms we advanced past account creation.
  await screen.findByText("One last step");
}

describe("AuthForm", () => {
  describe("initial state (login mode)", () => {
    it("renders in login mode by default", () => {
      render(<AuthForm />);
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    });

    it("does not show username or display name fields in login mode", () => {
      render(<AuthForm />);
      expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
    });

    it("shows email and password fields", () => {
      render(<AuthForm />);
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    });
  });

  describe("mode switching", () => {
    it("switches to signup mode when Sign up link is clicked", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: "Sign up" }));

      expect(screen.getByText("Create your account")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
    });

    it("collects only email + password in the signup step (username comes next)", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: "Sign up" }));

      expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it("clears the error message when switching modes", async () => {
      mockSignUp.mockResolvedValue({ error: { message: "Email already in use" }, hasSession: false });
      const user = userEvent.setup();
      render(<AuthForm />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await user.type(screen.getByLabelText(/email/i), "taken@example.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "password123");
      await user.click(screen.getAllByRole("button", { name: "Sign up" })[0]);
      // Raw Supabase messages are mapped to localized copy, never shown verbatim.
      expect(
        await screen.findByText("An account with this email already exists.")
      ).toBeInTheDocument();

      // Switch back to login — error should clear
      await user.click(screen.getByRole("button", { name: "Log in" }));
      expect(
        screen.queryByText("An account with this email already exists.")
      ).not.toBeInTheDocument();
    });
  });

  describe("signup step (account creation)", () => {
    it("creates the account with email and password, then shows the username step", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);
      await reachUsernameStep(user);

      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "john@example.com",
          password: "password123",
          emailRedirectTo: expect.stringContaining("/auth/callback"),
        })
      );
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    });

    it("shows a server error and stays on the signup step when creation fails", async () => {
      mockSignUp.mockResolvedValue({ error: { message: "Signup failed" }, hasSession: false });
      const user = userEvent.setup();
      render(<AuthForm />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await user.type(screen.getByLabelText(/email/i), "john@example.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "password123");
      await user.click(screen.getAllByRole("button", { name: "Sign up" })[0]);

      // An unrecognized raw message maps to the generic localized error.
      expect(
        await screen.findByText("Something went wrong. Please try again.")
      ).toBeInTheDocument();
      expect(screen.queryByText("One last step")).not.toBeInTheDocument();
    });

    it("shows the check-your-email panel when confirmation is required (no session)", async () => {
      mockSignUp.mockResolvedValue({ error: null, hasSession: false });
      const user = userEvent.setup();
      render(<AuthForm />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await user.type(screen.getByLabelText(/email/i), "john@example.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "password123");
      await user.click(screen.getAllByRole("button", { name: "Sign up" })[0]);

      expect(await screen.findByText("Check your email")).toBeInTheDocument();
      // The account was created; we did not advance to the username step.
      expect(screen.queryByText("One last step")).not.toBeInTheDocument();
    });

    it("blocks signup and shows an error when the two passwords differ", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await user.type(screen.getByLabelText(/email/i), "john@example.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.type(screen.getByLabelText(/confirm password/i), "different99");
      await user.click(screen.getAllByRole("button", { name: "Sign up" })[0]);

      expect(await screen.findByText("Passwords do not match")).toBeInTheDocument();
      expect(mockSignUp).not.toHaveBeenCalled();
    });
  });

  describe("username validation (setup step)", () => {
    // "must be" scopes this to the error copy (the username *hint* also mentions
    // "3–30 characters").
    const invalid = /must be 3.30 characters/i;

    it("rejects a username that is too short (< 3 chars)", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);
      await reachUsernameStep(user);

      await user.type(screen.getByLabelText(/username/i), "ab");
      await user.click(screen.getByRole("button", { name: "Get started" }));
      expect(await screen.findByText(invalid)).toBeInTheDocument();
      expect(mockClaim).not.toHaveBeenCalled();
    });

    it("rejects a username with invalid characters", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);
      await reachUsernameStep(user);

      await user.type(screen.getByLabelText(/username/i), "hello world!");
      await user.click(screen.getByRole("button", { name: "Get started" }));
      expect(await screen.findByText(invalid)).toBeInTheDocument();
      expect(mockClaim).not.toHaveBeenCalled();
    });

    it("claims a valid username (lowercased + trimmed) and navigates to the profile", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);
      await reachUsernameStep(user);

      await user.type(screen.getByLabelText(/username/i), "  ValidUser-123  ");
      await user.click(screen.getByRole("button", { name: "Get started" }));

      await waitFor(() =>
        expect(mockClaim).toHaveBeenCalledWith(
          expect.objectContaining({ username: "validuser-123" })
        )
      );
      await waitFor(() =>
        expect(window.location.assign).toHaveBeenCalledWith("/validuser-123")
      );
    });

    it("surfaces a taken username", async () => {
      mockClaim.mockResolvedValue({ ok: false, error: "USERNAME_TAKEN" });
      const user = userEvent.setup();
      render(<AuthForm />);
      await reachUsernameStep(user);

      await user.type(screen.getByLabelText(/username/i), "johndoe");
      await user.click(screen.getByRole("button", { name: "Get started" }));

      expect(await screen.findByText(/already taken/i)).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("login submission", () => {
    it("calls signInWithPassword with email and password", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "mypassword");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      await waitFor(() =>
        expect(mockSignIn).toHaveBeenCalledWith("user@example.com", "mypassword")
      );
    });

    it("redirects to /dashboard/contents on successful login", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "mypassword");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard/contents"));
    });

    it("displays a localized error (never the raw message) on failed login", async () => {
      mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "wrongpassword");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      expect(
        await screen.findByText("Incorrect email or password.")
      ).toBeInTheDocument();
      // The raw Supabase message must never appear.
      expect(screen.queryByText("Invalid login credentials")).not.toBeInTheDocument();
    });

    it("shows loading state while submitting", async () => {
      // Make signIn hang so we can catch the loading state
      mockSignIn.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.type(screen.getByLabelText(/^password$/i), "password");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      expect(await screen.findByText("Loading...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
    });
  });
});
