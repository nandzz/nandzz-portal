import { describe, it, expect } from "vitest";
import {
  currencySymbol,
  defaultCalendarMessages,
  localizedTemplate,
  normalizeCalendarMessages,
  renderTemplate,
  validateMessageTemplate,
} from "./messages";
import type { MessageTemplate } from "@/lib/types";

describe("currencySymbol", () => {
  it("maps known currency codes to their symbol, case-insensitively", () => {
    expect(currencySymbol("usd")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("gbp")).toBe("£");
  });

  it("uppercases an unknown code instead of guessing a symbol", () => {
    expect(currencySymbol("chf")).toBe("CHF");
  });

  it("defaults to the platform currency (€) when no code is given", () => {
    expect(currencySymbol(null)).toBe("€");
    expect(currencySymbol(undefined)).toBe("€");
  });
});

describe("renderTemplate", () => {
  it("substitutes known placeholders", () => {
    expect(renderTemplate("Hi {{customer_name}}!", { customer_name: "Jamie" })).toBe("Hi Jamie!");
  });

  it("tolerates internal whitespace inside the braces", () => {
    expect(renderTemplate("Hi {{ customer_name }}!", { customer_name: "Jamie" })).toBe("Hi Jamie!");
  });

  it("leaves unknown placeholders untouched so typos stay visible", () => {
    expect(renderTemplate("Hi {{typo_field}}!", { customer_name: "Jamie" })).toBe("Hi {{typo_field}}!");
  });

  it("substitutes a known key with an empty string when its value is empty", () => {
    expect(renderTemplate("Price: {{price}}", { price: "" })).toBe("Price: ");
  });

  it("substitutes every occurrence of a repeated placeholder", () => {
    expect(renderTemplate("{{x}} and {{x}}", { x: "A" })).toBe("A and A");
  });
});

describe("validateMessageTemplate", () => {
  it("accepts a disabled ('off') template regardless of body/subject", () => {
    const tpl: MessageTemplate = { channel: "off", subject: "", body: "" };
    expect(validateMessageTemplate(tpl, "Confirmation")).toEqual([]);
  });

  it("flags an empty body for an enabled channel", () => {
    const tpl: MessageTemplate = { channel: "whatsapp", subject: "", body: "   " };
    expect(validateMessageTemplate(tpl, "Confirmation").some((e) => e.includes("body"))).toBe(true);
  });

  it("does not require a subject for whatsapp-only", () => {
    const tpl: MessageTemplate = { channel: "whatsapp", subject: "", body: "Hi!" };
    expect(validateMessageTemplate(tpl, "Confirmation")).toEqual([]);
  });

  it("requires a subject when the channel includes email", () => {
    const tpl: MessageTemplate = { channel: "email", subject: "  ", body: "Hi!" };
    expect(validateMessageTemplate(tpl, "Confirmation").some((e) => e.includes("subject"))).toBe(true);
  });

  it("requires a subject for 'both'", () => {
    const tpl: MessageTemplate = { channel: "both", subject: "", body: "Hi!" };
    expect(validateMessageTemplate(tpl, "Confirmation").some((e) => e.includes("subject"))).toBe(true);
  });

  it("flags an invalid channel value", () => {
    const tpl = { channel: "sms", subject: "", body: "Hi!" } as unknown as MessageTemplate;
    expect(validateMessageTemplate(tpl, "Confirmation").some((e) => e.includes("channel"))).toBe(true);
  });
});

describe("normalizeCalendarMessages", () => {
  it("falls back to the default templates entirely when raw is not an object", () => {
    expect(normalizeCalendarMessages(null)).toEqual(defaultCalendarMessages());
    expect(normalizeCalendarMessages(undefined)).toEqual(defaultCalendarMessages());
  });

  it("normalizes confirmation and cancellation independently, keeping unset fields at their default", () => {
    const result = normalizeCalendarMessages({
      confirmation: { channel: "email", subject: "Custom subject", body: "Custom body" },
    });
    expect(result.confirmation).toEqual({
      channel: "email",
      subject: "Custom subject",
      body: "Custom body",
    });
    expect(result.cancellation).toEqual(defaultCalendarMessages().cancellation);
  });

  it("rejects an invalid channel value on a partial template, falling back to the default channel", () => {
    const result = normalizeCalendarMessages({
      confirmation: { channel: "sms", subject: "S", body: "B" },
    });
    expect(result.confirmation.channel).toBe(defaultCalendarMessages().confirmation.channel);
    // Non-channel fields on the same partial template are still honored.
    expect(result.confirmation.subject).toBe("S");
  });

  it("supplies defaults for the reschedule and reminder templates when absent", () => {
    const base = defaultCalendarMessages();
    // A legacy config carrying only the two original templates (no reschedule /
    // reminder / i18n) must still normalize cleanly to the new defaults.
    const result = normalizeCalendarMessages({
      confirmation: { channel: "email", subject: "Hi", body: "Body" },
      cancellation: { channel: "off", subject: "", body: "" },
    });
    expect(result.reschedule).toEqual(base.reschedule);
    expect(result.reminder).toEqual(base.reminder);
    // Original two are preserved, and no stray i18n is introduced.
    expect(result.confirmation).toEqual({ channel: "email", subject: "Hi", body: "Body" });
    expect(result.confirmation.i18n).toBeUndefined();
  });

  it("keeps valid per-locale overrides and drops empty / unknown ones", () => {
    const result = normalizeCalendarMessages({
      confirmation: {
        channel: "both",
        subject: "S",
        body: "B",
        i18n: {
          pt: { subject: "Assunto", body: "Corpo" },
          de: { body: "Nur Text" }, // partial override (body only) → kept
          fr: { subject: "   " }, // whitespace-only → treated as empty, dropped
          es: { subject: 5, body: null }, // non-string → dropped entirely
          xx: { subject: "nope" }, // unknown locale → ignored
        },
      },
    });
    expect(result.confirmation.i18n).toEqual({
      pt: { subject: "Assunto", body: "Corpo" },
      de: { body: "Nur Text" },
    });
  });

  it("omits i18n entirely when no valid override survives", () => {
    const result = normalizeCalendarMessages({
      confirmation: {
        channel: "both",
        subject: "S",
        body: "B",
        i18n: { es: { subject: 5 }, xx: { body: "x" } },
      },
    });
    expect(result.confirmation.i18n).toBeUndefined();
  });
});

describe("defaultCalendarMessages", () => {
  it("includes all four templates with sensible reschedule/reminder defaults", () => {
    const d = defaultCalendarMessages();
    expect(Object.keys(d).sort()).toEqual(["cancellation", "confirmation", "reminder", "reschedule"]);
    for (const key of ["reschedule", "reminder"] as const) {
      expect(d[key].channel).toBe("both");
      expect(d[key].subject).toContain("{{business}}");
      expect(d[key].body).toContain("{{customer_first_name}}");
      expect(d[key].body).toContain("{{date_time}}");
    }
    expect(d.reschedule.body).toContain("{{manage_url}}");
    expect(d.reminder.body).toContain("{{manage_url}}");
  });
});

describe("localizedTemplate", () => {
  const tpl: MessageTemplate = {
    channel: "both",
    subject: "Base subject",
    body: "Base body",
    i18n: {
      pt: { subject: "Assunto PT", body: "Corpo PT" },
      fr: { subject: "Sujet FR" }, // body override missing
    },
  };

  it("returns the per-locale override when present", () => {
    expect(localizedTemplate(tpl, "pt")).toEqual({ subject: "Assunto PT", body: "Corpo PT" });
  });

  it("falls back field-by-field to the base text", () => {
    // fr overrides subject only → body falls back to base.
    expect(localizedTemplate(tpl, "fr")).toEqual({ subject: "Sujet FR", body: "Base body" });
  });

  it("falls back to the base text for a locale with no override", () => {
    expect(localizedTemplate(tpl, "de")).toEqual({ subject: "Base subject", body: "Base body" });
  });

  it("falls back to the base text when there is no i18n map at all", () => {
    const plain: MessageTemplate = { channel: "email", subject: "S", body: "B" };
    expect(localizedTemplate(plain, "ja")).toEqual({ subject: "S", body: "B" });
  });
});
