// Tiny color utilities shared by the profile background theming.

/** Expand #rgb → #rrggbb and return { r, g, b } (0–255), or null if not a hex. */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * Whether a color is "dark" (should pair with light text/chrome). Uses the YIQ
 * perceived-brightness formula with the conventional 128 midpoint. Unknown /
 * malformed colors are treated as light (the app's default theme).
 */
export function isColorDark(hex: string | null | undefined): boolean {
  if (!hex) return false;
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq < 128;
}
