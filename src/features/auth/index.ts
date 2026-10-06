// Client-safe public API for the auth feature. All session-mutating Supabase
// The auth/feature-flag React context lives in "./AuthContext" and is imported
// by path (not through this barrel) so the root layout does not pull the forms.
// Auth calls live in "./auth" (client-side, outside components/ per the
// guardrail); the only Server Action is the setup-username profile claim, which
// is a pure data write that sets no auth cookies.
export { AuthForm, type AuthResult } from "./components/AuthForm";
export { AuthModal } from "./components/AuthModal";
export { ForgotPasswordForm } from "./components/ForgotPasswordForm";
export { ResetPasswordForm } from "./components/ResetPasswordForm";
export { ChangePasswordForm } from "./components/ChangePasswordForm";
export { PhoneVerificationForm } from "./components/PhoneVerificationForm";
export { DeleteAccount } from "./components/DeleteAccount";
export { claimSignupProfile } from "./actions/claim-signup-profile";
export type { ClaimSignupProfileResult } from "./actions/claim-signup-profile";
export { mapAuthError } from "./error-messages";
