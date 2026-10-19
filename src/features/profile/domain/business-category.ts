import type { Locale } from "@/lib/i18n/translations";

// Business categories a Business account picks when switching (and can change
// from Edit profile). Slugs are stored in profiles.category — the DB check
// constraint in migration 20261019120000 mirrors this list, so adding a slug
// here needs a migration too. Restaurants/food are deliberately absent (firm
// exclusion — see memory/portal/brand_pivot_explore_removed.md).
export const BUSINESS_CATEGORIES = [
  "hair_salon",
  "barber",
  "beauty",
  "spa_massage",
  "tattoo_piercing",
  "fitness",
  "yoga_pilates",
  "personal_trainer",
  "medical",
  "dental",
  "physiotherapy",
  "psychology",
  "nutrition",
  "pet_care",
  "photography",
  "education",
  "music_dance",
  "consulting",
  "events",
  "home_services",
  "automotive",
  "retail",
  "other",
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export function isBusinessCategory(v: unknown): v is BusinessCategory {
  return typeof v === "string" && (BUSINESS_CATEGORIES as readonly string[]).includes(v);
}

const LABELS: Record<BusinessCategory, Record<Locale, string>> = {
  hair_salon: { en: "Hair salon", pt: "Salão de cabeleireiro", fr: "Salon de coiffure", es: "Peluquería", ja: "ヘアサロン", de: "Friseursalon", it: "Parrucchiere" },
  barber: { en: "Barber", pt: "Barbearia", fr: "Barbier", es: "Barbería", ja: "理容室", de: "Barbier", it: "Barbiere" },
  beauty: { en: "Beauty, nails & lashes", pt: "Estética, unhas e cílios", fr: "Esthétique, ongles et cils", es: "Estética, uñas y pestañas", ja: "美容・ネイル・まつげ", de: "Kosmetik, Nägel & Wimpern", it: "Estetica, unghie e ciglia" },
  spa_massage: { en: "Spa & massage", pt: "Spa e massagem", fr: "Spa et massage", es: "Spa y masajes", ja: "スパ・マッサージ", de: "Spa & Massage", it: "Spa e massaggi" },
  tattoo_piercing: { en: "Tattoo & piercing", pt: "Tatuagem e piercing", fr: "Tatouage et piercing", es: "Tatuajes y piercing", ja: "タトゥー・ピアス", de: "Tattoo & Piercing", it: "Tatuaggi e piercing" },
  fitness: { en: "Gym & fitness", pt: "Academia e fitness", fr: "Salle de sport et fitness", es: "Gimnasio y fitness", ja: "ジム・フィットネス", de: "Fitnessstudio", it: "Palestra e fitness" },
  yoga_pilates: { en: "Yoga & pilates", pt: "Yoga e pilates", fr: "Yoga et pilates", es: "Yoga y pilates", ja: "ヨガ・ピラティス", de: "Yoga & Pilates", it: "Yoga e pilates" },
  personal_trainer: { en: "Personal trainer", pt: "Personal trainer", fr: "Coach sportif", es: "Entrenador personal", ja: "パーソナルトレーナー", de: "Personal Trainer", it: "Personal trainer" },
  medical: { en: "Medical clinic", pt: "Clínica médica", fr: "Cabinet médical", es: "Clínica médica", ja: "クリニック", de: "Arztpraxis", it: "Studio medico" },
  dental: { en: "Dentist", pt: "Dentista", fr: "Dentiste", es: "Dentista", ja: "歯科", de: "Zahnarzt", it: "Dentista" },
  physiotherapy: { en: "Physiotherapy", pt: "Fisioterapia", fr: "Kinésithérapie", es: "Fisioterapia", ja: "理学療法", de: "Physiotherapie", it: "Fisioterapia" },
  psychology: { en: "Psychology & therapy", pt: "Psicologia e terapia", fr: "Psychologie et thérapie", es: "Psicología y terapia", ja: "心理カウンセリング", de: "Psychologie & Therapie", it: "Psicologia e terapia" },
  nutrition: { en: "Nutrition", pt: "Nutrição", fr: "Nutrition", es: "Nutrición", ja: "栄養指導", de: "Ernährungsberatung", it: "Nutrizione" },
  pet_care: { en: "Pet care & grooming", pt: "Pet shop e banho e tosa", fr: "Toilettage et soins animaux", es: "Cuidado y peluquería de mascotas", ja: "ペットケア・トリミング", de: "Tierpflege & Hundesalon", it: "Toelettatura e cura animali" },
  photography: { en: "Photography", pt: "Fotografia", fr: "Photographie", es: "Fotografía", ja: "写真撮影", de: "Fotografie", it: "Fotografia" },
  education: { en: "Lessons & tutoring", pt: "Aulas e reforço", fr: "Cours et soutien scolaire", es: "Clases y tutorías", ja: "レッスン・家庭教師", de: "Unterricht & Nachhilfe", it: "Lezioni e ripetizioni" },
  music_dance: { en: "Music & dance", pt: "Música e dança", fr: "Musique et danse", es: "Música y baile", ja: "音楽・ダンス", de: "Musik & Tanz", it: "Musica e danza" },
  consulting: { en: "Consulting & professional services", pt: "Consultoria e serviços profissionais", fr: "Conseil et services professionnels", es: "Consultoría y servicios profesionales", ja: "コンサルティング・専門サービス", de: "Beratung & Dienstleistungen", it: "Consulenza e servizi professionali" },
  events: { en: "Events", pt: "Eventos", fr: "Événements", es: "Eventos", ja: "イベント", de: "Events", it: "Eventi" },
  home_services: { en: "Home services", pt: "Serviços domésticos", fr: "Services à domicile", es: "Servicios para el hogar", ja: "住まいのサービス", de: "Haushaltsdienste", it: "Servizi per la casa" },
  automotive: { en: "Automotive", pt: "Automotivo", fr: "Automobile", es: "Automoción", ja: "自動車サービス", de: "Kfz-Service", it: "Auto e moto" },
  retail: { en: "Shop", pt: "Loja", fr: "Boutique", es: "Tienda", ja: "ショップ", de: "Geschäft", it: "Negozio" },
  other: { en: "Other", pt: "Outro", fr: "Autre", es: "Otro", ja: "その他", de: "Sonstiges", it: "Altro" },
};

export function businessCategoryLabel(category: BusinessCategory, locale: Locale): string {
  return LABELS[category][locale] ?? LABELS[category].en;
}

// A business address counts only when it was picked from Places (coordinates
// present) — the DB trigger enforces the same on the personal → business flip.
export function isGeocodedAddress(
  a: { formatted?: string; lat?: number; lng?: number } | null | undefined
): boolean {
  return !!a?.formatted?.trim() && typeof a.lat === "number" && typeof a.lng === "number";
}
