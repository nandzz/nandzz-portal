import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CORE_TEMPLATES } from "@/lib/agent/templates";

type Message = { role: string; content: string };
type DocSummary = { title: string; visibility: string; status: string };

function hasCoreDoc(docs: DocSummary[], key: string): boolean {
  return docs.some((d) => d.title.toLowerCase().includes(key));
}

function buildMockResponse(
  messages: Message[],
  docs: DocSummary[]
): string {
  const last = messages[messages.length - 1]?.content?.toLowerCase() ?? "";
  const isEmpty = docs.length === 0;
  const missingCore = CORE_TEMPLATES.filter(
    (k) => !hasCoreDoc(docs, k === "response-style" ? "response" : k)
  );

  // First message / greeting
  if (messages.length <= 1 || last.includes("hello") || last.includes("hi ") || last.includes("start")) {
    if (isEmpty) {
      return `Welcome! Let's build your agent together.

Your agent is powered by Markdown documents you write on the left. The better your documents, the better your agent.

I recommend starting with three core documents:

1. **me.md** — who you are, your background, what you do right now
2. **soul.md** — your values, mission, and what drives you
3. **response-style.md** — how your agent communicates: tone, what to avoid, what to say when it doesn't know something

Click "Use template" next to any of these to start with a pre-filled structure. Which one feels most natural to start with?`;
    }
    const missing = missingCore.map((k) => `**${k}.md**`).join(", ");
    return `You have ${docs.length} document${docs.length !== 1 ? "s" : ""} set up. ${
      missingCore.length > 0
        ? `I'd suggest adding ${missing} to make your agent more complete.`
        : "Your core documents look good!"
    } What would you like to work on?`;
  }

  // What should I write first / where to start
  if (last.includes("first") || last.includes("start") || last.includes("where") || last.includes("begin")) {
    return `Start with **me.md** — it's the foundation everything else builds on.

Answer these questions in it:
- Who are you and what's your title/role?
- What are you currently building or working on?
- Where are you based?
- How should people reach you?

Keep it honest and specific. Vague answers like "I'm a builder" are less useful than "I'm a developer building Nandzz, a platform for sharing web tools."

Once that's done, **soul.md** adds depth — it's what makes your agent feel like you, not just a list of facts.`;
  }

  // Soul / values questions
  if (last.includes("soul") || last.includes("value") || last.includes("mission") || last.includes("believe")) {
    return `The **soul.md** document is optional but powerful. It answers the question visitors never ask directly but always sense: *who is this person really?*

Write it as if you're talking to someone who asked "what do you actually care about?"

Three things to capture:
1. **Core conviction** — the idea you keep returning to. One clear sentence.
2. **Values** — 3–5 things you won't compromise on, with a sentence on why each matters to *you* specifically
3. **What drives you** — the problem you care about or the change you want to make

Don't try to sound impressive. The best soul documents are honest and a little vulnerable.`;
  }

  // Response style
  if (last.includes("style") || last.includes("tone") || last.includes("communicate") || last.includes("voice")) {
    return `**response-style.md** controls how your agent talks — and it matters more than you'd expect.

The most useful things to define:

- **Tone**: one sentence that captures how you actually write. Are you dry? Warm? Direct? Informal?
- **What to avoid**: corporate-speak, excessive hedging, buzzwords?
- **Hard limits**: topics you don't discuss publicly (salary, personal relationships, unreleased work)
- **Default deflection**: what the agent says when it doesn't know something. "I don't have that information — feel free to reach out directly" works well.

The goal isn't to make the agent perfect — it's to make it sound like *you* rather than a generic assistant.`;
  }

  // Projects
  if (last.includes("project") || last.includes("work") || last.includes("building")) {
    return `For **projects.md**, structure matters more than completeness.

For each active project, write:
- What it is (one sentence, no jargon)
- Who it's for
- Current status
- A link if it's public

Don't skip past projects — they tell the story of how you got here, and visitors often find those more interesting than current work.

The section "What's next" is optional but good: it shows how you think without committing to specifics. "Exploring X" is enough.`;
  }

  // Private vs public
  if (last.includes("private") || last.includes("public") || last.includes("visibility") || last.includes("sensitive")) {
    return `Good question. Here's how to think about it:

**Public documents** are injected directly into your agent's context. When a visitor asks something, the agent reads these and answers from them.

**Private documents** are *not* used by the agent — they're only visible to you. Use them for drafts, notes, things you're still thinking through, or information that would be useful context for *you* but shouldn't be shared publicly.

The **Sensitive** flag is a reminder for yourself — it doesn't change visibility, it just marks documents that contain personally identifiable or restricted information.

A good rule of thumb: if you wouldn't answer it in a public tweet, don't put it in a public document.`;
  }

  // What's missing
  if (last.includes("missing") || last.includes("what else") || last.includes("complete") || last.includes("improve")) {
    if (missingCore.length === 0) {
      return `Your core setup looks solid — you have me.md, soul.md, and response-style.md covered.

From here, you could add:
- **projects.md** — specific work for visitors who want to know what you've built
- **expertise.md** — areas of knowledge, useful if people might want to collaborate or hire you
- Any other topic you get asked about regularly — FAQ-style documents work well

Keep documents focused. One topic per file is easier to maintain than one giant document.`;
    }
    return `You're still missing: ${missingCore.map((k) => `**${k}.md**`).join(", ")}.

${missingCore.includes("me") ? "• **me.md** is the most important — start there if you haven't.\n" : ""}${missingCore.includes("soul") ? "• **soul.md** adds authenticity and depth to your agent's answers.\n" : ""}${missingCore.includes("response-style") ? "• **response-style.md** controls tone and what the agent says when it doesn't know something.\n" : ""}
Use the templates on the left to get a structure you can fill in.`;
  }

  // Help writing / generate content
  if (last.includes("write") || last.includes("help me") || last.includes("generate") || last.includes("draft")) {
    return `I can help you draft content — just tell me more about yourself and I'll suggest text you can paste and edit.

To write your **me.md**, answer these:
1. What's your name and what do you do?
2. What's your current main project or focus?
3. Where are you based?
4. What's the best way for someone to reach you?

For **soul.md**, try answering:
- What problem do you care about most?
- What's something you believe that most people in your field don't?
- What would you work on even if no one paid you?

Give me your answers and I'll shape them into clean document content.`;
  }

  // Fallback
  return `Good question. Here's what I'd suggest thinking about:

Your agent is only as good as the documents behind it. The goal isn't to add as many documents as possible — it's to write a few very honest, specific ones.

Some questions worth asking yourself:
- What do people usually ask you about?
- What do you wish people understood about your work?
- What topics are off-limits publicly?

Start with those. Your agent will improve as you refine the documents over time — it's not a one-time setup, it's a living knowledge base.

What specific part of your agent would you like to work on?`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const { messages, docs } = (await req.json()) as {
    messages: Message[];
    docs: DocSummary[];
  };

  const responseText = buildMockResponse(messages, docs);
  const words = responseText.split(" ");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (const word of words) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ content: word + " " }) + "\n")
        );
        await new Promise((r) => setTimeout(r, 28));
      }
      controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + "\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
