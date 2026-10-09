import { z } from "zod";

export const REPORT_REASONS = [
  "illegal",
  "csam",
  "ip",
  "privacy",
  "hate",
  "violence",
  "fraud",
  "malware",
  "impersonation",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

// DSA Art. 16(2) notice. Name/email are optional for everyone (and must not be
// required for CSAM notices); the good-faith statement is mandatory.
export const contentReportSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" || u.protocol === "http:";
      } catch {
        return false;
      }
    }, "INVALID_URL"),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().min(10).max(5000),
  name: z.string().trim().max(200).optional().or(z.literal("")),
  email: z.string().trim().max(320).email().optional().or(z.literal("")),
  goodFaith: z.literal(true),
});

export type ContentReportInput = z.input<typeof contentReportSchema>;
