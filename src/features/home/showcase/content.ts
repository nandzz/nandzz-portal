import type { Translations } from "@/lib/i18n/translations";

// Copy for the home hero showcase lives in the locale dictionaries
// (`t.showcase`), like the rest of the app. Slide 1 reuses `home.*`.
//
// Rule: the showcase only shows what the real platform has. Strings inside the
// phone (`mock`) mirror the real UI labels (booking strings = `t.booking.*`,
// profile strings = `t.profile.*`, Style picker labels = ProfileStylePicker).
export type ShowcaseCopy = Translations["showcase"];
