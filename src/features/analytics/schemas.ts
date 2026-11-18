import { z } from "zod";

// space_views / spaces / notifications IDs are all Postgres
// `gen_random_uuid()` values — validate every action input as an RFC-4122 v4.

// A space view recorded by the immersive viewer (any visitor, incl. anonymous).
export const recordViewSchema = z.object({
  spaceId: z.uuid(),
  ownerId: z.uuid(),
});

export type RecordViewInput = z.infer<typeof recordViewSchema>;

// A visit to a public profile page (any visitor, incl. anonymous).
export const recordProfileViewSchema = z.object({
  profileId: z.uuid(),
});

// Mark a batch of the signed-in user's notifications as read.
export const markNotificationsReadSchema = z.object({
  ids: z.array(z.uuid()).min(1),
});

export type MarkNotificationsReadInput = z.infer<
  typeof markNotificationsReadSchema
>;
