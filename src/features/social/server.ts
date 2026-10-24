// Server-only entry for the social feature. Import read helpers from here in
// Server Components / route handlers; never from a Client Component.
export {
  getSpaceLiked,
  getLikedSpaceIds,
  getAllLikedSpaceIds,
  getSpaceLikesCount,
  getFollowingIds,
  getIsFollowing,
  getFollowingFeedPage,
  getFollowsAnyone,
} from "./data/social";
export type { FeedCursor } from "./data/social";
