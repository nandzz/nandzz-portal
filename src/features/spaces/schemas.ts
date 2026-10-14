import { z } from "zod";

// Space IDs are Postgres `gen_random_uuid()` values.
export const spaceIdSchema = z.object({ id: z.uuid() });

export type SpaceIdInput = z.infer<typeof spaceIdSchema>;

// The AI-edit job rows live in `ai_edit_jobs` (also `gen_random_uuid()`).
export const aiEditJobIdSchema = z.object({ jobId: z.uuid() });

export type AiEditJobIdInput = z.infer<typeof aiEditJobIdSchema>;

// In-place edit of an existing space row. `id` identifies the row; every other
// field is an optional column write. RLS guards ownership — the action only
// updates rows the caller owns. Snake_case mirrors the DB columns (and the
// `publishSpace` payload) so the builder hook can forward the same shape.
export const updateSpaceSchema = z.object({
  id: z.uuid(),
  // Empty allowed: image spaces have no title (caption + hashtags only).
  title: z.string().max(100).optional(),
  description: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  html_url: z.string().nullable().optional(),
  pdf_url: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  video_url: z.string().nullable().optional(),
  markdown_content: z.string().nullable().optional(),
  preview_image_url: z.string().nullable().optional(),
  preview_gradient: z.string().nullable().optional(),
  preview_title: z.string().nullable().optional(),
  is_public: z.boolean().optional(),
  hashtags: z.array(z.string()).optional(),
  content_type: z.string().optional(),
});

export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;
