import { z } from "zod";

// Input schemas for the social Server Actions. These run at the POST-reachable
// action boundary, so they validate untrusted client input before any DB access.
export const toggleLikeSchema = z.object({
  spaceId: z.uuid(),
});

export const toggleFollowSchema = z.object({
  profileId: z.uuid(),
  // Desired end state. Sent by the button so a double-tap / retry is
  // idempotent instead of flipping twice. Omitted = legacy toggle.
  follow: z.boolean().optional(),
});

export type ToggleLikeInput = z.infer<typeof toggleLikeSchema>;
export type ToggleFollowInput = z.infer<typeof toggleFollowSchema>;
