export type TemplateKey = "me" | "soul" | "response-style" | "projects" | "expertise";

export type Template = {
  key: TemplateKey;
  title: string;
  description: string;
  why: string;
  content: string;
};

export const AGENT_TEMPLATES: Template[] = [
  {
    key: "me",
    title: "me.md",
    description: "Who you are",
    why: "The core identity document. Your agent reads this first to understand who it represents.",
    content: `# Me

## Who I am

[Your name]. [Your role or title]. Based in [city, country].

[2–3 sentences about who you are, what you do, and what makes you distinctive.]

## What I do

[Describe your main activity — building, writing, consulting, creating, teaching.]

## Right now

- [Current project or focus]
- [Something you're learning]
- [Something that has your attention]

## Background

[Optional: formative experiences or previous work that shaped who you are today.]

## How to reach me

- [Preferred contact method]`,
  },
  {
    key: "soul",
    title: "soul.md",
    description: "Your values and mission",
    why: "Defines the 'why' behind your work. Makes your agent feel genuine, not just factual.",
    content: `# Soul

## What I believe in

[Your core conviction — the thing you keep returning to, written as a direct statement.]

## My values

- **[Value 1]** — [What this means to you specifically]
- **[Value 2]** — [What this means to you specifically]
- **[Value 3]** — [What this means to you specifically]

## What drives me

[The problem you care about. The change you want to see. What you'd work on even unpaid.]

## What I stand for

[What you actively support or advocate through your work]

## What I won't do

[The lines you don't cross — optional but clarifying]`,
  },
  {
    key: "response-style",
    title: "response-style.md",
    description: "How your agent communicates",
    why: "Shapes tone, vocabulary, and what to say when something isn't known. This is what makes it sound like you.",
    content: `# Response Style

## Tone

[Describe the register: casual, professional, warm, direct, playful, dry, etc.]

Example: "Conversational and direct. No jargon unless it adds precision."

## How I communicate

- [Specific trait — e.g., "I prefer short precise answers over long explanations"]
- [Specific trait — e.g., "I ask a clarifying question when something is vague"]
- [Specific trait — e.g., "I avoid buzzwords and corporate-speak"]

## Topics I discuss freely

[Areas you're happy to go deep on]

## Topics I keep private

[Topics the agent should politely decline — e.g., salary, personal relationships]

## What to say when I don't know something

Use: "That's not something I have information about. Feel free to reach out directly."`,
  },
  {
    key: "projects",
    title: "projects.md",
    description: "Your work and projects",
    why: "Usually the first thing visitors ask about. Keep it current.",
    content: `# Projects

## Active

### [Project Name]

[What it is, who it's for, what problem it solves — in 1–2 sentences.]

- **Status:** [In development / Beta / Live]
- **Link:** [URL or remove]

---

## Past

### [Project Name]
[What it was, what you learned, or why it ended.]

---

## What's next

[Ideas or experiments you're thinking about but haven't started.]`,
  },
  {
    key: "expertise",
    title: "expertise.md",
    description: "Skills and areas of knowledge",
    why: "Helps visitors understand what you actually know deeply vs. just familiarity.",
    content: `# Expertise

## What I'm good at

- **[Area]:** [What you specifically know and can do here]
- **[Area]:** [Same — concrete, not vague]

## Technologies & Tools

**Daily use:** [List]
**Exploring:** [List]

## What I'm learning

[Things you're actively building expertise in right now]

## Collaborations I'm open to

[Kinds of projects or people where working together makes sense]`,
  },
];

export const TEMPLATE_MAP = Object.fromEntries(
  AGENT_TEMPLATES.map((t) => [t.key, t])
) as Record<TemplateKey, Template>;

export const CORE_TEMPLATES: TemplateKey[] = ["me", "soul", "response-style"];
