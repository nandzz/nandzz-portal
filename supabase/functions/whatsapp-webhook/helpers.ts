export function normalizePhone(from: string): string {
  return from.replace(/^whatsapp:/i, "").replace(/^\+/, "");
}

export function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export function todayDateString(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
