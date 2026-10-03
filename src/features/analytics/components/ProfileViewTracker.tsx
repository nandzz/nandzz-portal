"use client";

import { useEffect } from "react";
import { recordProfileView } from "../actions/record-profile-view";

// Fires one profile-visit record on mount (the server dedupes per visitor/day).
export function ProfileViewTracker({ profileId }: { profileId: string }) {
  useEffect(() => {
    recordProfileView(profileId);
  }, [profileId]);
  return null;
}
