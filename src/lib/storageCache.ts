// Supabase Storage serves uploads with `Cache-Control: max-age=3600` unless the
// upload sets `cacheControl`. Objects stored at a unique path (timestamp/random
// name, never overwritten) can be cached by browsers and the CDN for a year.
// Never use this for upserted paths (avatars, logos, space HTML, screenshots).
export const IMMUTABLE_CACHE_CONTROL = "31536000";
