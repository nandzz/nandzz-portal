// Server-only entry for the social feature. Import read helpers from here in
// Server Components / route handlers; never from a Client Component.
export {
  getSpaceLiked,
  getLikedSpaceIds,
  getSpaceLikesCount,
} from "./data/social";
