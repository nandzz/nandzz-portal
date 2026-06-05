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

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const makeSpace = (id: string, title: string, hashtags: string[] = []): Space => ({
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
  comments_count: 0,
  hashtags,
  created_at: new Date().toISOString(),
});

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
      expect(screen.getByText("Create New Space")).toBeInTheDocument();
    });

    it("does not show create card by default", () => {
      render(<SpaceGrid spaces={allSpaces} />);
      expect(screen.queryByText("Create New Space")).not.toBeInTheDocument();
    });

    it("shows the empty state when filtered list is empty", () => {
      render(<SpaceGrid spaces={[]} />);
      expect(screen.getByText(/no spaces match this filter/i)).toBeInTheDocument();
    });
  });

  describe("hashtag filter", () => {
    it("lists all unique hashtags in the dropdown", () => {
      render(<SpaceGrid spaces={allSpaces} />);
      expect(screen.getByRole("option", { name: /#tool/i })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /#service/i })).toBeInTheDocument();
    });

    it("filters to #tool spaces when tool is selected", async () => {
      const user = userEvent.setup();
      render(<SpaceGrid spaces={allSpaces} />);

      await user.selectOptions(screen.getByRole("combobox"), "tag:tool");

      const cards = screen.getAllByTestId("space-card");
      expect(cards).toHaveLength(2);
      expect(screen.getByText("Space 1")).toBeInTheDocument();
      expect(screen.getByText("Space 3")).toBeInTheDocument();
    });

    it("filters to #service spaces when service is selected", async () => {
      const user = userEvent.setup();
      render(<SpaceGrid spaces={allSpaces} />);

      await user.selectOptions(screen.getByRole("combobox"), "tag:service");

      const cards = screen.getAllByTestId("space-card");
      expect(cards).toHaveLength(2);
      expect(screen.getByText("Space 2")).toBeInTheDocument();
      expect(screen.getByText("Space 3")).toBeInTheDocument();
    });

    it("resets to all spaces when All is selected", async () => {
      const user = userEvent.setup();
      render(<SpaceGrid spaces={allSpaces} />);

      await user.selectOptions(screen.getByRole("combobox"), "tag:tool");
      expect(screen.getAllByTestId("space-card")).toHaveLength(2);

      await user.selectOptions(screen.getByRole("combobox"), "all");
      expect(screen.getAllByTestId("space-card")).toHaveLength(3);
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
  });
});
