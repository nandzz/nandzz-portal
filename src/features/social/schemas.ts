import { z } from "zod";

// Input schemas for the social Server Actions. These run at the POST-reachable
// action boundary, so they validate untrusted client input before any DB access.
export const toggleLikeSchema = z.object({
  spaceId: z.uuid(),
});

export type ToggleLikeInput = z.infer<typeof toggleLikeSchema>;
