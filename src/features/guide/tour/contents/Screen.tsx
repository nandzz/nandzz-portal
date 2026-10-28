"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlignLeft,
  BarChart2,
  Check,
  EyeOff,
  FileText,
  Globe,
  Grid3X3,
  ImageIcon,
  LayoutGrid,
  Layers,
  Plus,
  Rocket,
  SlidersHorizontal,
} from "lucide-react";
import { EASE_OUT, useReduceMotion } from "@/features/home";
import { SpaceCard } from "@/features/spaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileGallery } from "@/components/profile/ProfileGallery";
import { ProfileLinks } from "@/components/profile/ProfileLinks";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  SECTION_ORDER,
  CONTENT_TYPES,
  getContentTypeDescription,
  getContentTypeLabel,
  getSectionDescription,
  getSectionLabel,
  type ContentTypeId,
  type SectionId,
} from "@/lib/spaces/content-types";
import type { Profile, Space } from "@/lib/types";
import type { TourScreenProps } from "../types";
import { buildSpaces, OWNER_ID, OWNER_USERNAME } from "./data";

type Tab = "all" | SectionId;

// step -> what the contents page shows (the picker and the profile are their own views)
const VIEW_FOR_STEP = ["dashboard", "dashboard", "dashboard", "picker", "dashboard", "profile"] as const;
const TAB_FOR_STEP: Tab[] = ["all", "gallery", "links", "all", "all", "all"];
function useSpaces() {
  const { t } = useLanguage();
  const sample = t.guidePage.tour.sample;
  return useMemo(() => buildSpaces(sample), [sample]);
}

function useSpacesBySection(): Record<SectionId, Space[]> {
  const { publications, gallery, links } = useSpaces();
  return { informative: publications, gallery, links };
}
// Step 4 shows the "Hidden on profile" badge on the first section.
const HIDDEN_AT_STEP: Partial<Record<number, SectionId>> = { 4: "informative" };

const fade = { duration: 0.3, ease: EASE_OUT };

export function ContentsScreen({ step }: TourScreenProps) {
  const view = VIEW_FOR_STEP[step] ?? "dashboard";
  return (
    <div className="absolute inset-0 overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={fade}
        >
          {view === "dashboard" && <DashboardView step={step} />}
          {view === "picker" && <PickerView />}
          {view === "profile" && <ProfileView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── /dashboard/contents ──────────────────────────────────────────────────────

function DashboardView({ step }: { step: number }) {
  const { t } = useLanguage();
  const reduce = useReduceMotion();
  const SPACES_BY_SECTION = useSpacesBySection();
  const tab = TAB_FOR_STEP[step] ?? "all";
  const hidden = HIDDEN_AT_STEP[step];
  const menuOpen = step === 4;
  // Single-section tabs show comfortable cards, the overview stays compact.
  const compact = tab === "all";
  // Gallery / Links: the page header scrolls out so the tabs and cards lead.
  const lift = tab !== "all";

  const sections: SectionId[] = tab === "all" ? SECTION_ORDER : [tab];

  return (
    <motion.div
      className="p-4 sm:p-6"
      animate={{ transform: lift && !reduce ? "translateY(-6.5rem)" : "translateY(0rem)" }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      {/* Page header (mirrors app/dashboard/contents/page.tsx) */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
              <LayoutGrid className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{t.dashboard.title}</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            {t.dashboard.welcomeBack.replace("{name}", "Studio Lume")}
          </p>
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
          <Button className="shrink-0">
            <Plus className="h-4 w-4" />
            {t.dashboard.createSpace}
          </Button>
          <Button variant="outline" className="shrink-0 gap-2 border-border/60">
            <Layers className="h-4 w-4" />
            {t.dashboard.collections}
          </Button>
          <Button variant="outline" className="hidden shrink-0 gap-2 border-border/60 md:inline-flex">
            <BarChart2 className="h-4 w-4" />
            {t.dashboard.analytics}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Toolbar (mirrors SpaceGrid): filter tabs + visibility gear + density */}
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted/40 p-1">
            <TabPill active={tab === "all"}>{t.spaceGrid.all}</TabPill>
            {SECTION_ORDER.map((id) => (
              <TabPill key={id} active={tab === id} count={SPACES_BY_SECTION[id].length}>
                {getSectionLabel(t, id)}
              </TabPill>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground",
                menuOpen && "bg-accent text-foreground",
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden sm:inline">{t.spaceGrid.profileVisibility}</span>
            </span>
            <span className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t.spaceGrid.compact}</span>
            </span>
          </div>
          <AnimatePresence>
            {menuOpen && <VisibilityMenu hidden={hidden} />}
          </AnimatePresence>
        </div>

        <div className="space-y-8">
          {sections.map((id) => (
            <motion.section
              key={`${tab}-${id}`}
              initial={{ opacity: 0, transform: reduce ? "none" : "translateY(8px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={fade}
            >
              <div className="mb-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  {getSectionLabel(t, id)}{" "}
                  <span className="font-normal tabular-nums text-muted-foreground">
                    {SPACES_BY_SECTION[id].length}
                  </span>
                  {hidden === id && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <EyeOff className="h-3 w-3" />
                      {t.spaceGrid.hiddenOnProfile}
                    </span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">{getSectionDescription(t, id)}</p>
              </div>
              <div
                className={
                  compact
                    ? "grid grid-cols-3 gap-2 sm:grid-cols-4"
                    : "grid grid-cols-1 gap-4 min-[520px]:grid-cols-2"
                }
              >
                {SPACES_BY_SECTION[id].map((space) => (
                  <SpaceCard
                    key={space.id}
                    space={space}
                    editable
                    isOwn
                    compact={compact}
                    routeUsername={OWNER_USERNAME}
                    hashtags={space.hashtags}
                  />
                ))}
              </div>
            </motion.section>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TabPill({ active, count, children }: { active: boolean; count?: number; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
      )}
    >
      {children}
      {count !== undefined && (
        <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
      )}
    </span>
  );
}

// The open "Profile visibility" menu (the real one is a Base UI popover that
// can't be driven from here, so this mirrors its look).
function VisibilityMenu({ hidden }: { hidden?: SectionId }) {
  const { t } = useLanguage();
  const reduce = useReduceMotion();
  return (
    <motion.div
      className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      initial={{ opacity: 0, transform: reduce ? "none" : "translateY(-4px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      exit={{ opacity: 0 }}
      transition={fade}
    >
      <p className="px-1.5 py-1 text-xs text-muted-foreground">{t.spaceGrid.visibilityHint}</p>
      <div className="-mx-1 my-1 h-px bg-border" />
      {SECTION_ORDER.map((id) => {
        const on = hidden !== id;
        return (
          <div key={id} className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 text-sm">
            {getSectionLabel(t, id)}
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-[4px] border",
                on ? "border-violet-600 bg-violet-600 text-white" : "border-border",
              )}
            >
              {on && <Check className="h-3 w-3" />}
            </span>
          </div>
        );
      })}
    </motion.div>
  );
}

// ── /dashboard/contents/create-space ─────────────────────────────────────────

const PICKER_ICONS: Partial<Record<ContentTypeId, typeof FileText>> = {
  pdf: FileText,
  notes: AlignLeft,
  image: ImageIcon,
  link: Globe,
};
// The AI builder is hidden while its flag is off, like the real picker.
const PICKER_TYPES = Object.values(CONTENT_TYPES).filter((c) => c.creatable && c.id !== "ai");

function PickerView() {
  const { t } = useLanguage();
  return (
    <div className="px-4 py-8 sm:py-10">
      <Card className="mx-auto w-full max-w-2xl border-border/60 shadow-lg shadow-black/5 dark:shadow-black/20">
        <CardHeader className="pb-4">
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
              <Rocket className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-xl">{t.contentPicker.title}</CardTitle>
              <CardDescription>{t.contentPicker.subtitle}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PICKER_TYPES.map(({ id }, i) => {
              const Icon = PICKER_ICONS[id] ?? Globe;
              return (
                <motion.div
                  key={id}
                  className="relative rounded-xl border-2 border-border/60 px-3 py-3 text-left"
                  initial={{ opacity: 0, transform: "translateY(8px)" }}
                  animate={{
                    opacity: 1,
                    transform: "translateY(0px)",
                    borderColor: id === "image" ? "rgb(139 92 246 / 0.45)" : undefined,
                  }}
                  transition={{ ...fade, delay: 0.08 * i }}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-semibold">{getContentTypeLabel(t, id)}</span>
                  </div>
                  <div className="text-xs leading-snug text-muted-foreground">
                    {getContentTypeDescription(t, id)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── /studiolume (what clients see) ───────────────────────────────────────────

// Only the fields the profile sections read.
const PROFILE = { id: OWNER_ID, username: OWNER_USERNAME, text_color: null } as unknown as Profile;

function ProfileView() {
  const { t } = useLanguage();
  const { publications: PUBLICATIONS, gallery: GALLERY, links: LINKS } = useSpaces();
  const reduce = useReduceMotion();
  return (
    <motion.div
      className="mx-auto max-w-2xl px-4 py-6 sm:px-6"
      initial={{ transform: "translateY(0rem)" }}
      animate={{ transform: reduce ? "translateY(0rem)" : "translateY(-12rem)" }}
      transition={{ duration: 3.6, delay: 0.9, ease: [0.45, 0, 0.55, 1] }}
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-400 text-lg font-bold text-white">
          SL
        </div>
        <h1 className="mt-3 text-xl font-bold">Studio Lume</h1>
        <p className="text-sm text-muted-foreground">@{OWNER_USERNAME}</p>
      </div>

      <div className="space-y-2">
        <ProfileGallery
          images={GALLERY.slice(0, 3)}
          totalCount={GALLERY.length}
          profile={PROFILE}
          isOwner={false}
          initialLayout="grid"
          initialCaptionStyle="card"
          seeMoreHref={`/${OWNER_USERNAME}/gallery`}
        />

        <div className="w-full">
          <h2 className="mb-4 text-lg font-semibold">
            {t.profile.contentsTitle}
            <span className="ml-1.5 text-sm font-normal tabular-nums text-muted-foreground">
              {PUBLICATIONS.length}
            </span>
          </h2>
          <div className="grid grid-cols-3 gap-3 pb-6">
            {PUBLICATIONS.map((space) => (
              <SpaceCard key={space.id} space={space} compact isOwn routeUsername={OWNER_USERNAME} />
            ))}
          </div>
        </div>

        <ProfileLinks
          links={LINKS}
          totalCount={LINKS.length}
          profile={PROFILE}
          initialLayout="grid"
        />
      </div>
    </motion.div>
  );
}
