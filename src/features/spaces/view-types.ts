// Client-safe shape of everything the immersive space viewer renders for one
// space. Built server-side (page + `loadSpaceView` action) so the viewer can
// swap between sibling spaces in place without a route navigation.
export type ViewerSpace = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  likes_count: number;
  url: string | null;
  html_url: string | null;
  video_url: string | null;
  pdf_url: string | null;
  image_url: string | null;
  markdown_content: string | null;
};

export type ViewerProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type SpaceView = {
  space: ViewerSpace;
  isOwner: boolean;
  liked: boolean;
  saved: boolean;
  /** Newer / older public sibling in the same profile section. */
  prevId: string | null;
  nextId: string | null;
  /** HTML space stored in our bucket → rendered via sandbox / owner editor. */
  htmlMode: boolean;
  /** HTML body contains download patterns (mobile warning). */
  downloadWarning: boolean;
};
