import type { Metadata } from "next";
import { getIsDemoProfile } from "@/features/profile/server";
import { DemoNoticeSheet } from "@/features/claim/components/DemoNoticeSheet";

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

// Demo pages open a notice on arrival: content may not match the business,
// and the business can claim the page (code → /claim) or request a code.
export default async function UsernameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const isDemo = await getIsDemoProfile(username);
  return (
    <>
      {children}
      {isDemo && <DemoNoticeSheet username={username.toLowerCase()} />}
    </>
  );
}
