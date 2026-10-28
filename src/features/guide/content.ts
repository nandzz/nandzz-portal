import type { Translations } from "@/lib/i18n/translations";

// Copy for the public /guide page lives in the locale dictionaries
// (`t.guidePage`), like the rest of the app. Strings shown inside the mock
// visuals live there too so the illustrations are localized.
export type GuideCopy = Translations["guidePage"];
export type { GuideFaq, GuideStep, GuideStepId, GuideTourChapter, GuideTourChapterId, GuideTourSample } from "@/lib/i18n/translations";
