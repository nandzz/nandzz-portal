export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

// My Agent is dev-only (FEATURES.businessAgent). The check reads the env var
// inline, not via FEATURES: the bundler only folds it to a literal here, which
// makes this branch (and the dynamic import behind it) dead code in prod — no
// My Agent server code, client chunks or server actions ship. Keep the import
// inside the branch; a top-level import would bundle it regardless.
export default async function Page(props: { params: Promise<{ section?: string[] }> }) {
  if (process.env.BUSINESS_AGENT_ENABLED === "1") {
    const { MyAgentPage } = await import("@/features/my-agent/pages/MyAgentPage");
    return MyAgentPage(props);
  }
  notFound();
}
