import type { Space } from "@/lib/types";
import type { GuideTourSample } from "../../content";

// Studio Lume's sample contents. Titles/captions are the salon's own words, so
// they come from the locale (`tour.sample`). Images are local assets so nothing
// hits the network.
export const OWNER_ID = "tour-owner";
export const OWNER_USERNAME = "studiolume";

function space(id: string, partial: Partial<Space>, daysAgo: number): Space {
  return {
    id,
    user_id: OWNER_ID,
    title: "",
    description: null,
    url: null,
    html_url: null,
    pdf_url: null,
    image_url: null,
    video_url: null,
    markdown_content: null,
    preview_image_url: null,
    preview_gradient: null,
    preview_title: null,
    is_public: true,
    likes_count: 0,
    views_count: 0,
    hashtags: [],
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    content_type: null,
    ...partial,
  };
}

const img = (n: number) => `/home/gallery-${n}.webp`;

type Spaces = { publications: Space[]; gallery: Space[]; links: Space[] };

const PUBS = [
  { id: "tour-pub-1", content_type: "pdf", pdf_url: "tour.pdf", preview_gradient: "violet", daysAgo: 3 },
  { id: "tour-pub-2", content_type: "notes", preview_gradient: "rose", daysAgo: 9 },
  { id: "tour-pub-3", content_type: "pdf", pdf_url: "tour.pdf", preview_gradient: "amber", daysAgo: 21 },
] as const;
const GALLERY_AGES = [1, 2, 5, 8, 12, 16];
const LINK_SEEDS = [
  { url: "https://instagram.com/studiolume", preview_gradient: "pink", daysAgo: 4 },
  { url: "https://maps.google.com/?q=studiolume", preview_gradient: "sky", daysAgo: 10 },
  { url: "https://youtube.com/@studiolume", preview_gradient: "rose", daysAgo: 18 },
];

export function buildSpaces(s: GuideTourSample): Spaces {
  return {
    publications: PUBS.map(({ id, daysAgo, ...rest }, i) => {
      const p = s.publications[i];
      return space(id, { ...rest, title: p.title, description: p.description, preview_title: p.preview, markdown_content: rest.content_type === "notes" ? `# ${p.title}` : null }, daysAgo);
    }),
    gallery: GALLERY_AGES.map((daysAgo, i) => {
      const g = s.gallery[i];
      const src = img(i + 1);
      return space(
        `tour-gal-${i + 1}`,
        { title: g.title, description: g.caption || null, content_type: "image", image_url: src, preview_image_url: src },
        daysAgo,
      );
    }),
    links: LINK_SEEDS.map(({ daysAgo, ...rest }, i) => {
      const l = s.links[i];
      return space(`tour-link-${i + 1}`, { ...rest, title: l.title, content_type: "link", preview_title: l.preview }, daysAgo);
    }),
  };
}
