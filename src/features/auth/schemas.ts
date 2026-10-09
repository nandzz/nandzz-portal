import { z } from "zod";
import { isReservedUsername } from "@/lib/layout/appShell";

// Input schema for the setup-username profile claim Server Action. Runs at the
// POST-reachable action boundary, so it validates untrusted client input before
// the RPC. The username rule mirrors the client-side regex in SetupUsernamePage
// (`^[a-z0-9_-]{3,30}$`); the DB (`claim_signup_profile`) remains the final
// authority and still enforces uniqueness + its own validation.
export const claimSignupProfileSchema = z.object({
  username: z
    .string()
    .regex(/^[a-z0-9_-]{3,30}$/)
    .refine((u) => !isReservedUsername(u)),
  displayName: z.string().max(50).nullable(),
});

export type ClaimSignupProfileInput = z.infer<typeof claimSignupProfileSchema>;
