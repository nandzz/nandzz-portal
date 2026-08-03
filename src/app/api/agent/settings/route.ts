import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_QUESTIONS = 6;
const MAX_QUESTION_CHARS = 120;

function sanitizeQuestions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((q): q is string => typeof q === "string")
    .map((q) => q.trim())
    .filter((q) => q.length > 0)
    .map((q) => q.slice(0, MAX_QUESTION_CHARS))
    .slice(0, MAX_QUESTIONS);
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("agent_enabled, agent_suggested_questions")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Only touch fields the caller actually provided so a partial PATCH is safe.
  const update: { agent_enabled?: boolean; agent_suggested_questions?: string[] } = {};
  if (typeof body.agent_enabled === "boolean") {
    update.agent_enabled = body.agent_enabled;
  }
  if ("agent_suggested_questions" in body) {
    update.agent_suggested_questions = sanitizeQuestions(body.agent_suggested_questions);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  // User-scoped client → RLS enforces the caller can only update their own profile.
  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("agent_enabled, agent_suggested_questions")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
