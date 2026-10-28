import type { Metadata } from "next";
import { getIsDemoProfile } from "@/features/profile/server";

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

export default function UsernameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
