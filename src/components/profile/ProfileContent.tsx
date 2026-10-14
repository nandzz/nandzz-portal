"use client";

import { SpaceCard } from "@/features/spaces";
import type { Space, Profile } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfileStyle } from "@/contexts/ProfileStyleContext";
import { SectionOwnerMenu } from "./SectionOwnerMenu";
import { SeeMoreLink } from "./SeeMoreLink";
import { updateProfileLayout } from "@/features/profile/actions/update-profile-layout";
import { useSerialSave } from "@/lib/useSerialSave";
import { CARD_LAYOUTS, type SectionLayout } from "@/lib/gallery/layouts";

interface ProfileContentProps {
  spaces: Space[];
  totalCount: number;
  profile: Profile;
  isOwner?: boolean;
  initialLayout: SectionLayout;
  likedSpaceIds?: string[];
  savedSpaceIds?: string[];
  currentUserId?: string;
}

export function ProfileContent({
  spaces,
  totalCount,
  profile,
  isOwner = false,
  initialLayout,
  likedSpaceIds = [],
  savedSpaceIds = [],
  currentUserId,
}: ProfileContentProps) {
  const { t } = useLanguage();
  // Live text color (owner Style picker previews instantly); prop outside a profile page.
  const liveStyle = useProfileStyle()?.style;
  const textColor = liveStyle ? liveStyle.textColor : profile.text_color;
  // Optimistic + strictly ordered saves (rapid picks can't land out of order
  // or be snapped back by an older save's refresh). The action revalidates the
  // public profile itself — no client revalidate fetch / router.refresh.
  const [layout, handleLayoutChange] = useSerialSave<SectionLayout>(initialLayout, async (value) => {
    const result = await updateProfileLayout({ contents_layout: value });
    if (!result.ok) throw new Error(result.error);
  });

  // Empty state is handled at the page level (so it isn't shown when the
  // gallery has images but there are no non-image contents).
  if (spaces.length === 0) return null;

  const renderCard = (space: Space, priority: boolean) => (
    <SpaceCard
      space={space}
      routeUsername={profile.username}
      liked={likedSpaceIds.includes(space.id)}
      saved={savedSpaceIds.includes(space.id)}
      isOwn={!!currentUserId && space.user_id === currentUserId}
      hashtags={space.hashtags ?? []}
      priority={priority}
      compact
    />
  );

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2
          className="text-lg font-semibold"
          style={textColor ? { color: textColor } : undefined}
        >
          {t.profile.contentsTitle}
          <span
            className="ml-1.5 text-sm font-normal text-muted-foreground tabular-nums"
            style={textColor ? { color: textColor, opacity: 0.65 } : undefined}
          >
            {totalCount}
          </span>
        </h2>

        {isOwner && (
          <SectionOwnerMenu
            sectionId="publications"
            sectionName={t.profile.contentsTitle}
            layouts={CARD_LAYOUTS}
            layout={layout}
            onLayoutChange={handleLayoutChange}
          />
        )}
      </div>

      <ContentLayoutView layout={layout} spaces={spaces} renderCard={renderCard} />

      {totalCount > spaces.length && (
        <SeeMoreLink label={t.profile.seeMore} href={`/${profile.username}/contents`} />
      )}
    </div>
  );
}

// ── Layout renderers ─────────────────────────────────────────────────────────

function ContentLayoutView({
  layout,
  spaces,
  renderCard,
}: {
  layout: SectionLayout;
  spaces: Space[];
  renderCard: (space: Space, priority: boolean) => React.ReactNode;
}) {
  if (layout === "grid") {
    return (
      <div className="grid grid-cols-2 gap-4 pb-6 sm:grid-cols-3">
        {spaces.map((space, i) => (
          <div key={space.id}>{renderCard(space, i === 0)}</div>
        ))}
      </div>
    );
  }

  if (layout === "featured") {
    return (
      <div className="grid grid-cols-2 gap-4 pb-6 sm:grid-cols-3">
        {spaces.map((space, i) => (
          <div key={space.id} className={i === 0 ? "col-span-2" : ""}>
            {renderCard(space, i === 0)}
          </div>
        ))}
      </div>
    );
  }

  if (layout === "justified") {
    return (
      <div className="flex flex-wrap gap-4 pb-6">
        {spaces.map((space, i) => (
          <div key={space.id} className="grow basis-[220px]">
            {renderCard(space, i === 0)}
          </div>
        ))}
      </div>
    );
  }

  // carousel (default)
  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto scroll-smooth px-1 pt-1 pb-6 snap-x snap-mandatory scrollbar-hide">
      {spaces.map((space, i) => (
        <div key={space.id} className="w-[240px] shrink-0 snap-start">
          {renderCard(space, i === 0)}
        </div>
      ))}
    </div>
  );
}
