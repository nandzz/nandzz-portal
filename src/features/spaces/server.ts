// Server-only barrel for the spaces feature. Anything that transitively pulls
// `import "server-only"` (the data/ read layer) lives here, not in index.ts, so
// the client-safe barrel stays importable from Client Components.
export { getPublicHashtags } from "./data/hashtags";
export { buildSpaceView } from "./data/space-view";
