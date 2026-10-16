// In-app browsers (Instagram, Facebook, TikTok, …) have no tabs: they fake a
// "new window" for target=_blank / window.open that starts on about:blank, so
// tapping back after visiting the link lands on an empty page instead of ours.
// In those webviews we navigate in place, keeping the back button working.
const IN_APP_UA = /Instagram|FBAN|FBAV|FB_IAB|Messenger|TikTok|musical_ly|Bytedance|Snapchat|Line\/|Twitter|LinkedInApp|Pinterest/i;

export function isInAppBrowser(): boolean {
  return typeof navigator !== "undefined" && IN_APP_UA.test(navigator.userAgent);
}

/** Open an external URL in a new tab, or in place inside in-app browsers. */
export function openExternal(url: string, { replace = false } = {}) {
  if (!isInAppBrowser()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (replace) location.replace(url);
  else location.assign(url);
}
