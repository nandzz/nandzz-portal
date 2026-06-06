// Replace base64-encoded data URIs with lightweight placeholders before sending
// HTML to Claude. This can cut token count by 80-90% on image-heavy pages.

export type AssetManifest = Record<string, string>;

export function stripBase64Assets(html: string): { stripped: string; manifest: AssetManifest } {
  const manifest: AssetManifest = {};
  let idx = 0;
  const stripped = html.replace(/(src|href)="(data:[^;]+;base64,[^"]+)"/gi, (_match, attr, dataUri) => {
    const key = `ASSET_PLACEHOLDER_${idx++}`;
    manifest[key] = dataUri;
    return `${attr}="data:${key}"`;
  });
  return { stripped, manifest };
}

export function restoreBase64Assets(html: string, manifest: AssetManifest): string {
  return html.replace(/data:(ASSET_PLACEHOLDER_\d+)/g, (_match, key) => {
    return manifest[key] ?? `data:${key}`;
  });
}
