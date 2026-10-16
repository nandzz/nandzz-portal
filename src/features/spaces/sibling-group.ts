// Which profile section a space belongs to, for left/right browsing in the
// viewer. Mirrors the profile page's section queries: images → Gallery,
// links/videos → Links (opened externally, so no browsing), everything else →
// Publications. A NULL type matches no section (the profile's `neq` filters
// drop NULLs too).
export type SiblingGroup = "gallery" | "publications";

export function siblingGroup(contentType: string | null): SiblingGroup | null {
  if (contentType === "image") return "gallery";
  if (!contentType || contentType === "link" || contentType === "video") return null;
  return "publications";
}
