import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SpaceGrid } from "./SpaceGrid";
import type { Space } from "@/lib/types";

vi.mock("./SpaceCard", () => ({
  SpaceCard: ({ space }: { space: Space }) => (
    <div data-testid="space-card" data-space-id={space.id}>
      {space.title}
    </div>
  ),
}));

// Keep this a rendering unit test — stub the visibility action so the profile
// feature's server barrel isn't pulled into the client test.
vi.mock("@/features/profile", () => ({
  setSectionVisibility: vi.fn(async () => ({ ok: true })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeSpace = (
  id: string,
  title: string,
  hashtags: string[] = [],
  contentType: Space["content_type"] = null
): Space => ({
  id,
  title,
  description: null,
  user_id: "user-1",
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
  hashtags,
  created_at: new Date().toISOString(),
  content_type: contentType,
});

// All three default to `content_type: null`, which falls back to "html"
// (legacy detection) — i.e. the "Informative" section.
const space1 = makeSpace("1", "Space 1", ["tool"]);
const space2 = makeSpace("2", "Space 2", ["service"]);
const space3 = makeSpace("3", "Space 3", ["tool", "service"]);

const allSpaces = [space1, space2, space3];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SpaceGrid", () => {
  describe("rendering", () => {
    it("renders all spaces with no filter", () => {
      render(<SpaceGrid spaces={allSpaces} />);
      expect(screen.getAllByTestId("space-card")).toHaveLength(3);
    });

    it("renders nothing when spaces array is empty", () => {
      render(<SpaceGrid spaces={[]} />);
      expect(screen.queryAllByTestId("space-card")).toHaveLength(0);
    });

    it("shows create card when showCreateCard is true", () => {
      render(<SpaceGrid spaces={[]} showCreateCard />);
      expect(screen.getByText("Create New Content")).toBeInTheDocument();
    });

    it("does not show create card by default", () => {
      render(<SpaceGrid spaces={allSpaces} />);
      expect(screen.queryByText("Create New Content")).not.toBeInTheDocument();
    });

    it("shows the empty state when filtered list is empty", () => {
      render(<SpaceGrid spaces={[]} />);
      expect(screen.getByText(/no content matches this filter/i)).toBeInTheDocument();
    });
  });

  describe("sectioning", () => {
    it("groups spaces into the correct section headings", () => {
      const notesSpace = makeSpace("n1", "Notes Space", [], "notes");
      const imageSpace = makeSpace("i1", "Image Space", [], "image");
      const linkSpace = makeSpace("l1", "Link Space", [], "link");

      render(<SpaceGrid spaces={[notesSpace, imageSpace, linkSpace]} />);

      expect(screen.getByRole("heading", { name: /Publication/ })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Gallery/ })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Links/ })).toBeInTheDocument();

      // Each section shows a count of its spaces.
      expect(screen.getByRole("heading", { name: /Publication 1/ })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Gallery 1/ })).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /Links 1/ })).toBeInTheDocument();
    });

    it("skips empty sections", () => {
      render(<SpaceGrid spaces={allSpaces} />);

      // allSpaces all resolve to "html" -> Informative only.
      expect(screen.getByRole("heading", { name: /Publication/ })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Gallery/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: /Links/ })).not.toBeInTheDocument();
    });

    it("renders sections in Informative, Gallery, Links order", () => {
      const imageSpace = makeSpace("i1", "Image Space", [], "image");
      const notesSpace = makeSpace("n1", "Notes Space", [], "notes");

      render(<SpaceGrid spaces={[imageSpace, notesSpace]} />);

      const headings = screen.getAllByRole("heading").map((h) => h.textContent);
      const contentIdx = headings.findIndex((h) => h?.includes("Publication"));
      const galleryIdx = headings.findIndex((h) => h?.includes("Gallery"));
      expect(contentIdx).toBeGreaterThanOrEqual(0);
      expect(galleryIdx).toBeGreaterThanOrEqual(0);
      expect(contentIdx).toBeLessThan(galleryIdx);
    });

    it("places all spaces from every section into the DOM", () => {
      const notesSpace = makeSpace("n1", "Notes Space", [], "notes");
      const imageSpace = makeSpace("i1", "Image Space", [], "image");
      const linkSpace = makeSpace("l1", "Link Space", [], "link");

      render(<SpaceGrid spaces={[notesSpace, imageSpace, linkSpace]} />);
      expect(screen.getAllByTestId("space-card")).toHaveLength(3);
    });

    it("shows only one create tile, even with multiple sections", () => {
      const notesSpace = makeSpace("n1", "Notes Space", [], "notes");
      const imageSpace = makeSpace("i1", "Image Space", [], "image");

      render(<SpaceGrid spaces={[notesSpace, imageSpace]} showCreateCard />);
      expect(screen.getAllByText("Create New Content")).toHaveLength(1);
    });
  });

  describe("compact toggle", () => {
    it("starts in comfortable view (Compact button visible)", () => {
      render(<SpaceGrid spaces={allSpaces} />);
      expect(screen.getByTitle("Compact view")).toBeInTheDocument();
    });

    it("switches to compact view on toggle click", async () => {
      const user = userEvent.setup();
      render(<SpaceGrid spaces={allSpaces} />);

      await user.click(screen.getByTitle("Compact view"));
      expect(screen.getByTitle("Comfortable view")).toBeInTheDocument();
    });

    it("toggles back to comfortable view", async () => {
      const user = userEvent.setup();
      render(<SpaceGrid spaces={allSpaces} />);

      await user.click(screen.getByTitle("Compact view"));
      await user.click(screen.getByTitle("Comfortable view"));
      expect(screen.getByTitle("Compact view")).toBeInTheDocument();
    });

    it("applies the compact grid classes to every section uniformly", async () => {
      const user = userEvent.setup();
      const notesSpace = makeSpace("n1", "Notes Space", [], "notes");
      const imageSpace = makeSpace("i1", "Image Space", [], "image");

      const { container } = render(
        <SpaceGrid spaces={[notesSpace, imageSpace]} />
      );

      const comfortableGrids = container.querySelectorAll(".sm\\:grid-cols-2");
      expect(comfortableGrids.length).toBe(2);

      await user.click(screen.getByTitle("Compact view"));

      const compactGrids = container.querySelectorAll(".sm\\:grid-cols-4");
      expect(compactGrids.length).toBe(2);
      expect(container.querySelectorAll(".sm\\:grid-cols-2").length).toBe(0);
    });
  });
});
