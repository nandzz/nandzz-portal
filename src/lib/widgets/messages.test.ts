import { describe, it, expect } from "vitest";
import {
  currencySymbol,
  defaultCalendarMessages,
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

  it("defaults to $ when no code is given", () => {
    expect(currencySymbol(null)).toBe("$");
    expect(currencySymbol(undefined)).toBe("$");
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
});
