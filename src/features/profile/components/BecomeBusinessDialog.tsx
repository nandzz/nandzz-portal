"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Apple,
  Brain,
  Briefcase,
  Camera,
  Car,
  Check,
  Dumbbell,
  Flower2,
  GraduationCap,
  HandHeart,
  Music,
  PartyPopper,
  PawPrint,
  PenTool,
  PersonStanding,
  Scissors,
  Search,
  ShoppingBag,
  Smile,
  Sparkles,
  Stethoscope,
  Store,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ProfileAddress } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { becomeBusiness } from "../actions/become-business";
import {
  BUSINESS_CATEGORIES,
  businessCategoryLabel,
  isBusinessCategory,
  isGeocodedAddress,
  type BusinessCategory,
} from "../domain/business-category";

export const BUSINESS_CATEGORY_ICONS: Record<BusinessCategory, LucideIcon> = {
  hair_salon: Scissors,
  barber: Scissors,
  beauty: Sparkles,
  spa_massage: Flower2,
  tattoo_piercing: PenTool,
  fitness: Dumbbell,
  yoga_pilates: PersonStanding,
  personal_trainer: Activity,
  medical: Stethoscope,
  dental: Smile,
  physiotherapy: HandHeart,
  psychology: Brain,
  nutrition: Apple,
  pet_care: PawPrint,
  photography: Camera,
  education: GraduationCap,
  music_dance: Music,
  consulting: Briefcase,
  events: PartyPopper,
  home_services: Wrench,
  automotive: Car,
  retail: ShoppingBag,
  other: Store,
};

interface BecomeBusinessDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-fill from the profile (an address set earlier, a category from a past switch). */
  initialCategory?: string | null;
  initialAddress?: ProfileAddress | null;
  /** Runs after the switch is persisted (the dialog already dispatched `profile-updated`). */
  onSuccess?: () => void;
}

// Replaces the plain "Switch to Business?" confirm: a business must say what it
// is (category) and where it is (Places-picked address with coordinates) so it
// can later be filtered by category and placed on a map.
export function BecomeBusinessDialog({
  open,
  onClose,
  initialCategory,
  initialAddress,
  onSuccess,
}: BecomeBusinessDialogProps) {
  const { t, locale } = useLanguage();
  const [category, setCategory] = useState<BusinessCategory | null>(
    isBusinessCategory(initialCategory) ? initialCategory : null
  );
  const [address, setAddress] = useState<ProfileAddress | null>(initialAddress ?? null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // "Other" always sorts last; the rest alphabetically in the visitor's language.
  const options = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale);
    return BUSINESS_CATEGORIES.map((c) => ({ id: c, label: businessCategoryLabel(c, locale) }))
      .filter((o) => !q || o.label.toLocaleLowerCase(locale).includes(q))
      .sort((a, b) =>
        a.id === "other" ? 1 : b.id === "other" ? -1 : a.label.localeCompare(b.label, locale)
      );
  }, [query, locale]);

  const addressOk = isGeocodedAddress(address);
  // Typed something but never picked a suggestion → nudge, don't block silently.
  const addressNeedsPick = !!address?.formatted?.trim() && !addressOk;
  const canSubmit = !!category && addressOk && !busy;

  const close = () => {
    if (busy) return;
    setError("");
    onClose();
  };

  const submit = async () => {
    if (!canSubmit || !category || !address || !addressOk) return;
    setBusy(true);
    setError("");
    const res = await becomeBusiness({ category, address });
    setBusy(false);
    if (!res.ok) {
      setError(t.nav.switchToBusinessError);
      return;
    }
    window.dispatchEvent(new Event("profile-updated"));
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title={t.nav.switchToBusinessTitle} maxWidthClass="max-w-lg">
      <p className="text-sm text-muted-foreground mb-5">{t.nav.switchToBusinessDesc}</p>

      <div className="space-y-2 mb-5">
        <Label htmlFor="business-category-search">{t.nav.businessCategoryLabel}</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="business-category-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.nav.businessCategorySearch}
            autoComplete="off"
            className="pl-9"
          />
        </div>
        {/* Bounded height: 23 categories never push the address off-screen. */}
        <div className="relative">
          <div
            role="radiogroup"
            aria-label={t.nav.businessCategoryLabel}
            className="scrollbar-hide grid max-h-52 grid-cols-1 gap-1.5 overflow-y-auto pb-4 sm:grid-cols-2"
          >
            {options.map(({ id, label }) => {
              const Icon = BUSINESS_CATEGORY_ICONS[id];
              const selected = category === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setCategory(id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm",
                    "transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.97]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-violet-500/60 bg-violet-500/10 text-foreground"
                      : "border-border/60 hover:bg-accent"
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn("h-4 w-4 shrink-0", selected ? "text-violet-600" : "text-muted-foreground")}
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {selected && <Check aria-hidden className="h-4 w-4 shrink-0 text-violet-600" />}
                </button>
              );
            })}
            {options.length === 0 && (
              <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
                {t.nav.businessCategoryNone}
              </p>
            )}
          </div>
          {/* Edge fade hints there's more below without a scrollbar. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent" />
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <Label htmlFor="business-address">{t.nav.businessAddressLabel}</Label>
        <AddressAutocomplete
          id="business-address"
          value={address}
          onChange={setAddress}
          placeholder={t.settings.addressPlaceholder}
        />
        <p className={cn("text-xs", addressNeedsPick ? "text-amber-600" : "text-muted-foreground")}>
          {t.nav.businessAddressHint}
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={busy}>
          {t.common.cancel}
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {t.nav.switchToBusinessConfirm}
        </Button>
      </div>
    </Dialog>
  );
}
