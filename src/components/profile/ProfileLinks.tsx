"use client";

import { LinkChip } from "./LinkChip";
import type { Space, Profile } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfileStyle } from "@/contexts/ProfileStyleContext";
import { SectionOwnerMenu } from "./SectionOwnerMenu";
import { SeeMoreLink } from "./SeeMoreLink";
import { updateProfileLayout } from "@/features/profile/actions/update-profile-layout";
import { useSerialSave } from "@/lib/useSerialSave";
import { CARD_LAYOUTS, type SectionLayout } from "@/lib/gallery/layouts";

interface ProfileLinksProps {
  links: Space[];
  totalCount: number;
  profile: Profile;
  isOwner?: boolean;
  initialLayout: SectionLayout;
}

/** The profile's Links section — a set of link "chips" (favicon + title + host)
 * the owner can arrange as a horizontal shelf, grid, justified rows, or with a
 * featured first chip. Distinct from the Publications section, which shows
 * space cards. Empty state is handled at the page level. */
export function ProfileLinks({
  links,
  totalCount,
  profile,
  isOwner = false,
  initialLayout,
}: ProfileLinksProps) {
  const { t } = useLanguage();
  // Live text color (owner Style picker previews instantly); prop outside a profile page.
  const liveStyle = useProfileStyle()?.style;
  const textColor = liveStyle ? liveStyle.textColor : profile.text_color;
  // Optimistic + strictly ordered saves (rapid picks can't land out of order
  // or be snapped back by an older save's refresh). The action revalidates the
  // public profile itself — no client revalidate fetch / router.refresh.
  const [layout, handleLayoutChange] = useSerialSave<SectionLayout>(initialLayout, async (value) => {
    const result = await updateProfileLayout({ links_layout: value });
    if (!result.ok) throw new Error(result.error);
  });

  if (links.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-lg font-semibold"
          style={textColor ? { color: textColor } : undefined}
        >
          {t.profile.linksTitle}
          <span
            className="ml-1.5 text-sm font-normal text-muted-foreground tabular-nums"
            style={textColor ? { color: textColor, opacity: 0.65 } : undefined}
          >
            {totalCount}
          </span>
        </h2>

        {isOwner && (
          <SectionOwnerMenu
            sectionId="links"
            sectionName={t.profile.linksTitle}
            layouts={CARD_LAYOUTS}
            layout={layout}
            onLayoutChange={handleLayoutChange}
          />
        )}
      </div>

      <LinksLayoutView layout={layout} links={links} />

      {totalCount > links.length && (
        <SeeMoreLink label={t.profile.seeMore} href={`/${profile.username}/links`} />
      )}
    </div>
  );
}

// ── Layout renderers ─────────────────────────────────────────────────────────

function LinksLayoutView({ layout, links }: { layout: SectionLayout; links: Space[] }) {
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-4 pb-6 sm:grid-cols-3">
        {links.map((space, i) => (
          <LinkChip key={space.id} space={space} priority={i === 0} />
        ))}
      </div>
    );
  }

  if (layout === "featured") {
    return (
      <div className="grid grid-cols-2 gap-4 pb-6 sm:grid-cols-3">
        {links.map((space, i) => (
          <div key={space.id} className={i === 0 ? "col-span-2" : ""}>
            <LinkChip space={space} priority={i === 0} />
          </div>
        ))}
      </div>
    );
  }

  if (layout === "justified") {
    return (
      <div className="flex flex-wrap gap-4 pb-6">
        {links.map((space, i) => (
          <div key={space.id} className="grow basis-[240px]">
            <LinkChip space={space} priority={i === 0} />
          </div>
        ))}
      </div>
    );
  }

  // carousel (default)
  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto scroll-smooth px-1 pt-1 pb-6 snap-x snap-mandatory scrollbar-hide">
      {links.map((space, i) => (
        <div key={space.id} className="w-[240px] shrink-0 snap-start">
          <LinkChip space={space} priority={i === 0} />
        </div>
      ))}
    </div>
  );
}
