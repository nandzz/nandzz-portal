import { ProfileSkeletonFrame } from "@/features/profile/components/ProfileHeaderSkeleton";

// The header part (and cover) follow the profile's header layout; see
// ProfileSkeletonFrame.
export default function ProfileLoading() {
  return (
    <ProfileSkeletonFrame>
      {/* Content section skeleton */}
      <div className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-6 w-20 rounded bg-muted motion-safe:animate-pulse" />
          <div className="h-5 w-16 rounded bg-muted motion-safe:animate-pulse" />
        </div>

        {/* Horizontal-scroll carousel skeleton */}
        <div className="flex gap-4 overflow-hidden pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-[260px] shrink-0 rounded-xl border border-border/60 overflow-hidden">
              <div className="aspect-video bg-muted motion-safe:animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-5 w-3/4 rounded bg-muted motion-safe:animate-pulse" />
                <div className="h-4 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ProfileSkeletonFrame>
  );
}
