// Client-safe public API for the social feature (likes).
// Server-only read helpers live in "./server" so this barrel can be imported
// from Client Components without pulling in `server-only` modules.
export { LikeButton } from "./components/LikeButton";
export type { ToggleLikeResult } from "./actions/toggle-like";
