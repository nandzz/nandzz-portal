/** Single max length for a description-derived title (cards, headers, meta). */
const DERIVED_TITLE_MAX = 80;

/**
 * The text to show where a space's title goes. Image spaces are published
 * without a title (caption + hashtags only — `title` is stored as ""), so fall
 * back to the first line of the description, then to `fallback`.
 */
export function spaceDisplayTitle(
  space: { title?: string | null; description?: string | null },
  fallback = ""
): string {
  const title = space.title?.trim();
  if (title) return title;
  const firstLine = space.description?.trim().split("\n")[0]?.trim();
  if (firstLine) {
    return firstLine.length > DERIVED_TITLE_MAX
      ? `${firstLine.slice(0, DERIVED_TITLE_MAX - 1).trimEnd()}…`
      : firstLine;
  }
  return fallback;
}
