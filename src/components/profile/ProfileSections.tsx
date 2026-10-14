"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { updateProfileLayout } from "@/features/profile/actions/update-profile-layout";
import { useSerialSave } from "@/lib/useSerialSave";
import { SectionOrderContext } from "./section-order-context";
import type { SectionId } from "@/lib/gallery/layouts";

interface ProfileSectionsProps {
  /** Rendered section content keyed by id; a `null` value is skipped (the owner
   * has that section but it's empty, or a visitor can't see it). */
  sections: Record<SectionId, ReactNode>;
  /** The owner's chosen order (already resolved to the full set of ids). */
  order: SectionId[];
  isOwner: boolean;
  profileId: string;
  username: string;
}

const sameOrder = (a: SectionId[], b: SectionId[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Renders the profile's three sections in the owner's chosen order. The owner
 * reorders them from the menu in each section header (see `SectionOwnerMenu`),
 * which reads the order from this component's context; the new order persists
 * to `profiles.section_order`. Visitors just see the sections in order with no
 * controls.
 */
export function ProfileSections({
  sections,
  order: initialOrder,
  isOwner,
}: ProfileSectionsProps) {
  // Optimistic + strictly ordered saves: quick consecutive moves can't land
  // out of order or be snapped back by an older save's refresh.
  const [order, commit] = useSerialSave<SectionId[]>(
    initialOrder,
    async (next) => {
      const result = await updateProfileLayout({ section_order: next });
      if (!result.ok) throw new Error(result.error);
    },
    sameOrder,
  );

  // Only sections with content are shown, so reordering operates on those; any
  // hidden section keeps its stored position by trailing the persisted order.
  const visibleOrder = useMemo(
    () => order.filter((id) => sections[id]),
    [order, sections],
  );

  const move = useCallback(
    (id: SectionId, dir: -1 | 1) => {
      const visible = order.filter((x) => sections[x]);
      const idx = visible.indexOf(id);
      const swapWith = idx + dir;
      if (idx === -1 || swapWith < 0 || swapWith >= visible.length) return;
      const next = [...visible];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      const hidden = order.filter((x) => !sections[x]);
      commit([...next, ...hidden]);
    },
    [order, sections, commit],
  );

  const content = order.map((id) => {
    const node = sections[id];
    if (!node) return null;
    return (
      <div key={id} className="mt-12">
        {node}
      </div>
    );
  });

  if (!isOwner) return <>{content}</>;

  return (
    <SectionOrderContext.Provider value={{ order: visibleOrder, move }}>
      {content}
    </SectionOrderContext.Provider>
  );
}
