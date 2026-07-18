import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthForm } from "./AuthForm";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockSignUp = vi.fn();
const mockSignIn = vi.fn();

const mockSearchParams = { get: vi.fn().mockReturnValue(null) };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp,
      signInWithPassword: mockSignIn,
    },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockSignUp.mockResolvedValue({ error: null });
  mockSignIn.mockResolvedValue({ error: null });
});

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
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
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

    it("shows username and display name fields after switching to signup", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.click(screen.getByRole("button", { name: "Sign up" }));

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    });

    it("clears error message when switching modes", async () => {
      const user = userEvent.setup();
      // Start in signup mode
      render(<AuthForm />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      // Trigger a validation error
      await user.click(screen.getByRole("button", { name: "Sign up" }));
      // The submit button is also "Sign up" — need to target the form submit
      // Actually the mode-switch button and submit button share the same name in signup,
      // but the submit is type="submit" and the switch is type="button"
      // Let's trigger an error by submitting with empty username via form submit
      const submitBtn = screen.getByRole("button", { name: "Sign up", hidden: false });
      // There are two "Sign up" buttons when in signup mode: the form submit and none (only Log in link)
      // Actually in signup mode: submit = "Sign up", switch = "Log in"
      // So we can target submit directly
      await user.type(screen.getByLabelText(/username/i), "   "); // spaces pass `required`, fail JS trim check
      await user.type(screen.getByLabelText(/email/i), "test@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getAllByRole("button", { name: "Sign up" })[0]);
      expect(await screen.findByText(/username is required/i)).toBeInTheDocument();

      // Switch back to login — error should clear
      await user.click(screen.getByRole("button", { name: "Log in" }));
      expect(screen.queryByText(/username is required/i)).not.toBeInTheDocument();
    });
  });

  describe("username validation (signup mode)", () => {
    async function enterSignupMode(user: ReturnType<typeof userEvent.setup>) {
      render(<AuthForm />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));
    }

    async function fillAndSubmit(
      user: ReturnType<typeof userEvent.setup>,
      fields: { username?: string; email?: string; password?: string }
    ) {
      if (fields.username !== undefined) {
        await user.type(screen.getByLabelText(/username/i), fields.username);
      }
      if (fields.email !== undefined) {
        await user.type(screen.getByLabelText(/email/i), fields.email);
      }
      if (fields.password !== undefined) {
        await user.type(screen.getByLabelText(/password/i), fields.password);
      }
      // Click the submit button (type="submit" inside the form)
      const buttons = screen.getAllByRole("button", { name: "Sign up" });
      // The form submit button is the one inside the form (not the mode-switch which is "Log in" now)
      // In signup mode the submit button text is "Sign up" and mode-switch is "Log in"
      await user.click(buttons[0]);
    }

    it("shows error when username is only whitespace", async () => {
      // Type spaces so the HTML `required` constraint passes but JS trim check fails
      const user = userEvent.setup();
      await enterSignupMode(user);
      await fillAndSubmit(user, { username: "   ", email: "test@test.com", password: "password123" });
      expect(await screen.findByText(/username is required/i)).toBeInTheDocument();
    });

    it("shows error when username is too short (< 3 chars)", async () => {
      const user = userEvent.setup();
      await enterSignupMode(user);
      await fillAndSubmit(user, { username: "ab", email: "test@test.com", password: "password123" });
      expect(await screen.findByText(/3.30 characters/i)).toBeInTheDocument();
    });

    it("shows error when username contains invalid characters", async () => {
      const user = userEvent.setup();
      await enterSignupMode(user);
      await fillAndSubmit(user, { username: "hello world!", email: "test@test.com", password: "password123" });
      expect(await screen.findByText(/lowercase letters, numbers, hyphens, and underscores/i)).toBeInTheDocument();
    });

    it("shows error when username is too long (> 30 chars)", async () => {
      const user = userEvent.setup();
      await enterSignupMode(user);
      await fillAndSubmit(user, {
        username: "a".repeat(31),
        email: "test@test.com",
        password: "password123",
      });
      expect(await screen.findByText(/3.30 characters/i)).toBeInTheDocument();
    });

    it("accepts valid usernames (lowercase, numbers, hyphen, underscore)", async () => {
      const user = userEvent.setup();
      await enterSignupMode(user);
      await fillAndSubmit(user, { username: "valid_user-123", email: "test@test.com", password: "password123" });
      // No validation error should appear
      expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
      await waitFor(() => expect(mockSignUp).toHaveBeenCalledOnce());
    });
  });

  describe("login submission", () => {
    it("calls signInWithPassword with email and password", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.type(screen.getByLabelText(/password/i), "mypassword");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      await waitFor(() =>
        expect(mockSignIn).toHaveBeenCalledWith({
          email: "user@example.com",
          password: "mypassword",
        })
      );
    });

    it("redirects to /dashboard on successful login", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.type(screen.getByLabelText(/password/i), "mypassword");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/dashboard"));
    });

    it("displays server error message on failed login", async () => {
      mockSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.type(screen.getByLabelText(/password/i), "wrongpassword");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    });

    it("shows loading state while submitting", async () => {
      // Make signIn hang so we can catch the loading state
      mockSignIn.mockImplementation(() => new Promise(() => {}));
      const user = userEvent.setup();
      render(<AuthForm />);

      await user.type(screen.getByLabelText(/email/i), "user@example.com");
      await user.type(screen.getByLabelText(/password/i), "password");
      await user.click(screen.getByRole("button", { name: "Log in" }));

      expect(await screen.findByText("Loading...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
    });
  });

  describe("signup submission", () => {
    it("calls signUp with email, password and user metadata", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await user.type(screen.getByLabelText(/username/i), "johndoe");
      await user.type(screen.getByLabelText(/display name/i), "John Doe");
      await user.type(screen.getByLabelText(/email/i), "john@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getAllByRole("button", { name: "Sign up" })[0]);

      await waitFor(() =>
        expect(mockSignUp).toHaveBeenCalledWith({
          email: "john@example.com",
          password: "password123",
          options: {
            data: {
              username: "johndoe",
              display_name: "John Doe",
            },
          },
        })
      );
    });

    it("lowercases and trims the username before submitting", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await user.type(screen.getByLabelText(/username/i), "  JohnDoe  ");
      await user.type(screen.getByLabelText(/email/i), "john@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getAllByRole("button", { name: "Sign up" })[0]);

      await waitFor(() =>
        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              data: expect.objectContaining({ username: "johndoe" }),
            }),
          })
        )
      );
    });

    it("uses username as display_name when display name is left empty", async () => {
      const user = userEvent.setup();
      render(<AuthForm />);
      await user.click(screen.getByRole("button", { name: "Sign up" }));

      await user.type(screen.getByLabelText(/username/i), "johndoe");
      await user.type(screen.getByLabelText(/email/i), "john@example.com");
      await user.type(screen.getByLabelText(/password/i), "password123");
      await user.click(screen.getAllByRole("button", { name: "Sign up" })[0]);

      await waitFor(() =>
        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            options: expect.objectContaining({
              data: expect.objectContaining({ display_name: "johndoe" }),
            }),
          })
        )
      );
    });
  });
});
