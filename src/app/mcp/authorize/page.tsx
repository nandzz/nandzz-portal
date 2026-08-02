import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type SP = {
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
  response_type?: string;
};

// Human-readable scope descriptions shown on the consent card. One scope can
// map to multiple bullets when the underlying tools do meaningfully different
// things (e.g. `publish` also grants update/edit tools).
const SCOPE_LABELS: Record<string, string[]> = {
  publish: [
    "Publish HTML pages, PDFs, and images to your Nandzz space",
    "Replace the content of spaces you already own",
    "Edit a space's title, description, hashtags, or visibility",
  ],
  read: ["List your collections"],
};

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  // Validate the required OAuth params up front.
  if (
    sp.response_type !== "code" ||
    !sp.client_id ||
    !sp.redirect_uri ||
    !sp.code_challenge ||
    sp.code_challenge_method !== "S256"
  ) {
    return (
      <ErrorCard
        title="Invalid authorization request"
        detail="This link is missing required OAuth parameters or uses an unsupported challenge method. Only response_type=code with PKCE S256 is accepted."
      />
    );
  }

  // Require login — bounce through /login with a return URL.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const query = new URLSearchParams(sp as Record<string, string>).toString();
    redirect(`/login?next=${encodeURIComponent(`/mcp/authorize?${query}`)}`);
  }

  // Look up the client so we can show its name — and reject unknown clients
  // or a redirect_uri that isn't on the client's registered list.
  const admin = createAdminClient();
  const { data: client } = await admin
    .from("mcp_oauth_clients")
    .select("id, client_name, redirect_uris")
    .eq("id", sp.client_id)
    .maybeSingle();

  if (!client) {
    return <ErrorCard title="Unknown client" detail="This app is not registered with Nandzz." />;
  }
  if (!(client.redirect_uris as string[]).includes(sp.redirect_uri)) {
    return (
      <ErrorCard
        title="Redirect URI mismatch"
        detail="The requested redirect_uri is not registered for this client."
      />
    );
  }

  const clientName = client.client_name || "An external app";
  const scopes = (sp.scope ?? "publish read").split(/\s+/).filter(Boolean);

  return (
    <div className="relative flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-8">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-violet-100/50 blur-3xl dark:bg-violet-950/25" />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
          Grant access to Nandzz?
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{clientName}</span>{" "}
          is requesting access to your account.
        </p>

        <div className="mt-6 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            This app will be able to:
          </p>
          <ul className="mt-3 space-y-2">
            {scopes.flatMap((s) => (SCOPE_LABELS[s] ?? [s]).map((label) => ({ scope: s, label }))).map(({ scope, label }) => (
              <li key={`${scope}:${label}`} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-violet-500" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-500">
          Signed in as <span className="font-mono">{user.email}</span>. Publishes cost credits from your
          Nandzz balance. You can revoke access anytime from Settings.
        </p>

        <form method="POST" action="/api/mcp/oauth/consent" className="mt-6 flex gap-3">
          <input type="hidden" name="client_id" value={sp.client_id} />
          <input type="hidden" name="redirect_uri" value={sp.redirect_uri} />
          <input type="hidden" name="code_challenge" value={sp.code_challenge} />
          <input type="hidden" name="code_challenge_method" value={sp.code_challenge_method} />
          {sp.state ? <input type="hidden" name="state" value={sp.state} /> : null}
          <input type="hidden" name="scope" value={scopes.join(" ")} />

          <button
            type="submit"
            name="action"
            value="deny"
            className="flex-1 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Deny
          </button>
          <button
            type="submit"
            name="action"
            value="allow"
            className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Allow
          </button>
        </form>
      </div>
    </div>
  );
}

function ErrorCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-8 dark:border-red-900/50 dark:bg-red-950/30">
        <h1 className="text-lg font-semibold text-red-900 dark:text-red-200">{title}</h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">{detail}</p>
      </div>
    </div>
  );
}
