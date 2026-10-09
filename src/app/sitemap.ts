import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BASE_URL = "https://nandzz.com";

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
    const admin = createAdminClient();

    const [{ data: profiles }, { data: spaces }] = await Promise.all([
      admin
        .from("profiles")
        .select("username, updated_at")
        .not("username", "is", null)
        .order("created_at", { ascending: false })
        .limit(1000),
      admin
        .from("spaces")
        .select("id, user_id, updated_at, profiles(username)")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    const profilePages: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
      url: `${BASE_URL}/${p.username}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    const spacePages: MetadataRoute.Sitemap = (spaces ?? [])
      .filter((s) => {
        const profile = s.profiles as unknown as { username: string | null } | null;
        return profile?.username;
      })
      .map((s) => {
        const profile = s.profiles as unknown as { username: string };
        return {
          url: `${BASE_URL}/${profile.username}/space/${s.id}`,
          lastModified: s.updated_at ? new Date(s.updated_at) : new Date(),
          changeFrequency: "weekly" as const,
          priority: 0.5,
        };
      });

    return [...staticPages, ...profilePages, ...spacePages];
  } catch {
    return staticPages;
  }
}
