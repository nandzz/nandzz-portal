import type { Metadata } from "next";
import { getIsDemoProfile, getDemoVideoUrl } from "@/features/profile/server";
import { DemoNoticeSheet } from "@/features/claim/components/DemoNoticeSheet";
import { DemoVideoSheet } from "@/features/claim/components/DemoVideoSheet";

// Covers every route under a profile (page, contents, gallery, links, booking,
// space, agent): demo profiles are never indexed. Child pages don't set
// `robots`, so this overrides the root layout's index:true.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  if (!(await getIsDemoProfile(username))) return {};
  return {
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

// Demo pages mount a notice, opened only from the visitor pill: content may not
// match the business, and the business can claim the page (code → /claim) or
// request a code. A demo with a pitch video also mounts the video, which opens by
// itself on the first visit.
export default async function UsernameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const isDemo = await getIsDemoProfile(username);
  const videoUrl = isDemo ? await getDemoVideoUrl(username) : null;
  return (
    <>
      {children}
      {isDemo && <DemoNoticeSheet username={username.toLowerCase()} hasVideo={!!videoUrl} />}
      {videoUrl && <DemoVideoSheet username={username.toLowerCase()} src={videoUrl} />}
    </>
  );
}
