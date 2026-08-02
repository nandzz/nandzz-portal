export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { Plug, Sparkles, Coins, Shield, FileText, Image as ImageIcon, FileCode2, FolderKanban, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getServerTranslations } from "@/lib/i18n/server";
import { CopyField } from "./CopyField";
import { Sessions } from "./Sessions";

export default async function McpConnectPage() {
  const supabase = await createClient();
  const t = await getServerTranslations();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/mcp");

  const [{ data: profile }, { data: rawSessions }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .single(),
    supabase
      .from("mcp_tokens")
      .select("id, name, token_prefix, created_at, last_used_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const greeting = profile?.display_name || profile?.username || "there";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const mcpUrl = siteUrl ? `${siteUrl}/api/mcp` : "/api/mcp";

  const tools = [
    { name: "publish_html", icon: FileCode2, desc: t.mcp.toolPublishHtml },
    { name: "publish_pdf",  icon: FileText,  desc: t.mcp.toolPublishPdf },
    { name: "publish_image",icon: ImageIcon, desc: t.mcp.toolPublishImage },
    { name: "list_collections", icon: FolderKanban, desc: t.mcp.toolListCollections },
  ];

  const initialSessions = (rawSessions ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string | null) ?? null,
    token_prefix: s.token_prefix as string,
    created_at: s.created_at as string,
    last_used_at: (s.last_used_at as string | null) ?? null,
  }));

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
              <Plug className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{t.mcp.title}</h1>
          </div>
          <p className="mt-2 text-muted-foreground text-lg">
            {t.mcp.subtitle.replace("{name}", greeting)}
          </p>
        </div>

        {/* Server URL */}
        <section className="mb-8 rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t.mcp.serverUrl}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.mcp.serverUrlDesc}</p>
          <div className="mt-4">
            {mcpUrl ? (
              <CopyField value={mcpUrl} copyLabel={t.mcp.copy} copiedLabel={t.mcp.copied} />
            ) : (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t.mcp.serverUrlMissing}
              </p>
            )}
          </div>
        </section>

        {/* How to connect */}
        <section className="mb-8 rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t.mcp.howToConnect}</h2>

          <div className="mt-4 space-y-6">
            <Step n={1} title={t.mcp.step1Title} body={t.mcp.step1Body} />
            <Step n={2} title={t.mcp.step2Title} body={t.mcp.step2Body} />
            <Step n={3} title={t.mcp.step3Title} body={t.mcp.step3Body} />
          </div>
        </section>

        {/* What Claude can do */}
        <section className="mb-8 rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            {t.mcp.toolsHeading}
          </h2>
          <ul className="mt-4 divide-y divide-border/60">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <li key={tool.name} className="flex items-start gap-3 py-3">
                  <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-muted/60">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-mono text-sm">{tool.name}</p>
                    <p className="text-sm text-muted-foreground">{tool.desc}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Active connections / sessions */}
        <section className="mb-8 rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            {t.mcp.sessionsTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.mcp.sessionsDesc}</p>
          <div className="mt-4">
            <Sessions initial={initialSessions} />
          </div>
        </section>

        {/* Fine print */}
        <section className="grid gap-3 sm:grid-cols-2">
          <InfoCard
            icon={Coins}
            title={t.mcp.creditsTitle}
            body={t.mcp.creditsBody}
            href="/dashboard/credits"
            hrefLabel={t.mcp.viewBalance}
          />
          <InfoCard
            icon={Shield}
            title={t.mcp.controlTitle}
            body={t.mcp.controlBody}
          />
        </section>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
        {n}
      </div>
      <div className="pt-0.5">
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
  href,
  hrefLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      {href && hrefLabel ? (
        <Link href={href} className="mt-2 inline-block text-sm font-medium text-violet-600 hover:underline dark:text-violet-400">
          {hrefLabel} →
        </Link>
      ) : null}
    </div>
  );
}
