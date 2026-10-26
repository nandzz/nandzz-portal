import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { translations } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/i18n/translations";

function Probe() {
  const { locale, t, setLocale } = useLanguage();
  return (
    <>
      <p data-testid="probe">
        {locale}:{t.home.heroLine1}
      </p>
      {(["ja", "de", "fr"] as Locale[]).map((l) => (
        <button key={l} onClick={() => setLocale(l)}>
          {l}
        </button>
      ))}
    </>
  );
}

const switchTo = (lang: Locale) => fireEvent.click(screen.getByRole("button", { name: lang }));

const text = () => screen.getByTestId("probe").textContent;

describe("LanguageProvider", () => {
  beforeEach(() => {
    document.cookie = "nandzz-lang=; path=/; max-age=0";
    document.documentElement.lang = "en";
  });

  it("renders the server-provided language on first paint", () => {
    document.cookie = "nandzz-lang=it; path=/";
    render(
      <LanguageProvider initialLocale="it" initialTranslations={translations.it}>
        <Probe />
      </LanguageProvider>,
    );
    expect(text()).toBe(`it:${translations.it.home.heroLine1}`);
  });

  it("loads another language on switch and updates cookie + html lang", async () => {
    document.cookie = "nandzz-lang=en; path=/";
    render(
      <LanguageProvider initialLocale="en">
        <Probe />
      </LanguageProvider>,
    );
    expect(text()).toBe(`en:${translations.en.home.heroLine1}`);

    switchTo("ja");
    expect(document.cookie).toContain("nandzz-lang=ja");
    await waitFor(() => expect(text()).toBe(`ja:${translations.ja.home.heroLine1}`));
    expect(document.documentElement.lang).toBe("ja");
  });

  it("ends on the last language picked when switches overlap", async () => {
    document.cookie = "nandzz-lang=en; path=/";
    render(
      <LanguageProvider initialLocale="en">
        <Probe />
      </LanguageProvider>,
    );
    switchTo("de");
    switchTo("fr");
    await waitFor(() => expect(text()).toBe(`fr:${translations.fr.home.heroLine1}`));
    await new Promise((r) => setTimeout(r, 20));
    expect(text()).toBe(`fr:${translations.fr.home.heroLine1}`);
  });

  it("adopts the cookie language after hydration when it differs", async () => {
    document.cookie = "nandzz-lang=pt; path=/";
    render(
      <LanguageProvider initialLocale="en">
        <Probe />
      </LanguageProvider>,
    );
    await waitFor(() => expect(text()).toBe(`pt:${translations.pt.home.heroLine1}`));
  });
});
