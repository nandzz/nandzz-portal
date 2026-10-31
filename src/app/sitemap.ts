import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL = "https://nandzz.com";

// Neither profiles nor spaces has an updated_at column: selecting it made the
// query fail and the catch below silently served only the static pages. The
// read is cached for an hour so crawler hits don't each query the database.
const getIndexableEntries = unstable_cache(
  async () => {
    const admin = createAdminClient();
    const [profilesRes, spacesRes] = await Promise.all([
      admin
        .from("profiles")
        .select("username, created_at")
        .not("username", "is", null)
        // Business pages only: client accounts are near-empty pages, and demos
        // are unclaimed pitches (also noindex in app/[username]/layout.tsx).
        .eq("account_type", "business")
        .eq("is_demo", false)
        .order("created_at", { ascending: false })
        .limit(1000),
      admin
        .from("spaces")
        .select("id, created_at, profiles!inner(username, is_demo)")
        .eq("is_public", true)
        .eq("profiles.is_demo", false)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);
    // Throw instead of caching an empty sitemap for an hour.
    if (profilesRes.error) throw profilesRes.error;
    if (spacesRes.error) throw spacesRes.error;
    return { profiles: profilesRes.data, spaces: spacesRes.data };
  },
  ["sitemap-entries"],
  { revalidate: 3600 }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/guide`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    ...["/terms", "/cookies", "/acceptable-use", "/dpa", "/legal", "/report"].map((path) => ({
      url: `${BASE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  try {
    const { profiles, spaces } = await getIndexableEntries();

    const profilePages: MetadataRoute.Sitemap = profiles.map((p) => ({
      url: `${BASE_URL}/${p.username}`,
      lastModified: new Date(p.created_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    const spacePages: MetadataRoute.Sitemap = spaces
      .filter((s) => {
        const profile = s.profiles as unknown as { username: string | null } | null;
        return profile?.username;
      })
      .map((s) => {
        const profile = s.profiles as unknown as { username: string };
        return {
          url: `${BASE_URL}/${profile.username}/space/${s.id}`,
          lastModified: new Date(s.created_at),
          changeFrequency: "weekly" as const,
          priority: 0.5,
        };
      });

    return [...staticPages, ...profilePages, ...spacePages];
  } catch {
    return staticPages;
  }
}
