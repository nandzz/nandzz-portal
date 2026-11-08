import type { Metadata } from "next";
import { getIsDemoProfile, getDemoVideoUrl, getPublicProfile } from "@/features/profile/server";
import { DemoNoticeSheet } from "@/features/claim/components/DemoNoticeSheet";
import { DemoVideoSheet } from "@/features/claim/components/DemoVideoSheet";
import { DemoWhySheet } from "@/features/claim/components/DemoWhySheet";

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
// itself on every visit. Every demo also mounts the "why am I seeing this"
// disclosure (DemoWhySheet), reachable from the pill, the video and the notice.
export default async function UsernameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [isDemo, profile] = await Promise.all([
    getIsDemoProfile(username),
    getPublicProfile(username),
  ]);
  const videoUrl = isDemo ? await getDemoVideoUrl(username) : null;
  // Starter/Pro owners hide the Nandzz "Create your page" pill (ProfileVisitorCta,
  // mounted by AppChrome, which can't see the owner's plan). A server-rendered
  // marker + a `:has()` rule in globals.css hides it with no flash on load.
  // Demo pages keep the pill: it carries their "Claim it" chip.
  const hideBadge = !isDemo && profile?.hide_branding === true;
  return (
    <>
      {hideBadge && <span data-hide-profile-badge hidden />}
      {children}
      {isDemo && <DemoNoticeSheet username={username.toLowerCase()} hasVideo={!!videoUrl} />}
      {isDemo && <DemoWhySheet username={username.toLowerCase()} />}
      {videoUrl && <DemoVideoSheet username={username.toLowerCase()} src={videoUrl} />}
    </>
  );
}
