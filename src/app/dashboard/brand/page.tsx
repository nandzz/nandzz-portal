"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadMyProfile, updateBrand } from "@/features/profile";
import { uploadBrandLogo } from "@/features/profile/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Palette, X } from "lucide-react";
import { AvatarCropModal } from "@/components/ui/AvatarCropModal";
import { PageShell } from "@/components/layout/PageShell";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Profile } from "@/lib/types";

const LIMITS = {
  brandDescription: 500,
  brandValue: 30,
  brandValuesMax: 10,
};

const COLOR_KEYS = ["primary", "accent", "background"] as const;
type ColorKey = (typeof COLOR_KEYS)[number];

const DEFAULT_COLORS: Record<ColorKey, string> = {
  primary: "#7c3aed",
  accent: "#f59e0b",
  background: "#ffffff",
};

// Busts the CDN/browser cache after a logo overwrite at the same storage path.
function withCacheBust(url: string) {
  return `${url}?t=${Date.now()}`;
}

function isValidHex(value: string) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

export default function BrandPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const COLOR_LABELS: Record<ColorKey, string> = {
    primary: t.brand.colorPrimary,
    accent: t.brand.colorAccent,
    background: t.brand.colorBackground,
  };

  const [profile, setProfile] = useState<Profile | null>(null);
  const [brandDescription, setBrandDescription] = useState("");
  const [brandValues, setBrandValues] = useState<string[]>([]);
  const [valueInput, setValueInput] = useState("");
  const [brandColors, setBrandColors] = useState<Record<ColorKey, string>>(DEFAULT_COLORS);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const result = await loadMyProfile();
      if (!result.ok) {
        router.push("/login");
        return;
      }

      const data = result.profile;
      if (data) {
        setProfile(data);
        setBrandDescription(data.brand_description || "");
        setBrandValues(data.brand_values || []);
        setBrandColors({ ...DEFAULT_COLORS, ...(data.brand_colors || {}) });
      }
    };
    loadProfile();
  }, [router]);

  const addBrandValue = () => {
    const value = valueInput.trim();
    if (!value) return;
    if (brandValues.length >= LIMITS.brandValuesMax) return;
    if (brandValues.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setValueInput("");
      return;
    }
    setBrandValues([...brandValues, value.slice(0, LIMITS.brandValue)]);
    setValueInput("");
  };

  const removeBrandValue = (value: string) => {
    setBrandValues(brandValues.filter((v) => v !== value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      if (!profile) return;

      if (brandDescription.length > LIMITS.brandDescription) {
        setError(t.brand.descriptionTooLongError.replace("{n}", String(LIMITS.brandDescription)));
        setLoading(false);
        return;
      }

      for (const key of COLOR_KEYS) {
        if (!isValidHex(brandColors[key])) {
          setError(t.brand.colorInvalidError.replace("{color}", COLOR_LABELS[key]));
          setLoading(false);
          return;
        }
      }

      let logo_url = profile.logo_url || null;

      if (logoFile) {
        // Logo upload stays client-side (see features/profile/storage).
        try {
          const publicUrl = await uploadBrandLogo(profile.id, logoFile);
          logo_url = withCacheBust(publicUrl);
        } catch (uploadErr) {
          console.error("[brand] logo upload failed:", uploadErr);
          setError(t.common.error);
          setLoading(false);
          return;
        }
      }

      const result = await updateBrand({
        logoUrl: logo_url,
        brandColors,
        brandValues,
        brandDescription: brandDescription || null,
      });

      if (!result.ok) throw new Error(result.error || "brand_update_failed");

      await fetch("/api/profile/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: profile.username }),
      });

      setSuccess(true);
      window.dispatchEvent(new CustomEvent("profile-updated"));
      router.refresh();
    } catch (err: unknown) {
      console.error("[brand] save failed:", err);
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <PageShell width="narrow">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
          <Palette className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.brand.heading}</h1>
          <p className="mt-1 text-muted-foreground">
            {t.brand.headingDesc}
          </p>
        </div>
      </div>

      <Card className="w-full shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">{t.brand.cardTitle}</CardTitle>
          <CardDescription>
            {t.brand.cardDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Logo */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
              <Avatar className="h-16 w-16 border-2 border-amber-200 dark:border-amber-800 rounded-lg">
                <AvatarImage
                  src={
                    logoFile
                      ? URL.createObjectURL(logoFile)
                      : profile.logo_url || undefined
                  }
                />
                <AvatarFallback className="text-xl bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 rounded-lg">
                  {profile.display_name?.[0]?.toUpperCase() ||
                    profile.username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1.5 flex-1">
                <Label className="font-medium">{t.brand.logoLabel}</Label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png, image/jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 1.5 * 1024 * 1024) {
                      setError(t.brand.logoMaxSizeError);
                      e.target.value = "";
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => setCropImageSrc(reader.result as string);
                    reader.readAsDataURL(file);
                    // reset so re-selecting same file re-triggers
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {t.settings.chooseImage}
                </button>
                {logoFile && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t.brand.newLogoReady}
                  </p>
                )}
              </div>
            </div>

            {cropImageSrc && (
              <AvatarCropModal
                imageSrc={cropImageSrc}
                onCancel={() => setCropImageSrc(null)}
                onCrop={(blob) => {
                  setLogoFile(new File([blob], "logo.jpg", { type: "image/jpeg" }));
                  setCropImageSrc(null);
                }}
              />
            )}

            {/* Brand description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="brandDescription">{t.brand.descriptionLabel}</Label>
                <span
                  className={`text-xs ${
                    brandDescription.length >= LIMITS.brandDescription
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {brandDescription.length}/{LIMITS.brandDescription}
                </span>
              </div>
              <Textarea
                id="brandDescription"
                placeholder={t.brand.descriptionPlaceholder}
                value={brandDescription}
                onChange={(e) => setBrandDescription(e.target.value.slice(0, LIMITS.brandDescription))}
                rows={4}
                className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
              />
            </div>

            {/* Brand values */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="brandValueInput">{t.brand.valuesLabel}</Label>
                <span className="text-xs text-muted-foreground">
                  {brandValues.length}/{LIMITS.brandValuesMax}
                </span>
              </div>
              <div className="flex gap-2">
                <Input
                  id="brandValueInput"
                  placeholder={t.brand.valuePlaceholder}
                  value={valueInput}
                  onChange={(e) => setValueInput(e.target.value.slice(0, LIMITS.brandValue))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addBrandValue();
                    }
                  }}
                  maxLength={LIMITS.brandValue}
                  disabled={brandValues.length >= LIMITS.brandValuesMax}
                  className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addBrandValue}
                  disabled={!valueInput.trim() || brandValues.length >= LIMITS.brandValuesMax}
                >
                  {t.booking.addButton}
                </Button>
              </div>
              {brandValues.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {brandValues.map((value) => (
                    <span
                      key={value}
                      className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-3 py-1 text-sm text-violet-700 dark:text-violet-300"
                    >
                      {value}
                      <button
                        type="button"
                        onClick={() => removeBrandValue(value)}
                        aria-label={t.brand.removeValueAria.replace("{value}", value)}
                        className="rounded-full hover:bg-violet-200/60 dark:hover:bg-violet-800/60 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Brand colors */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">{t.brand.colorsLabel}</Label>
              <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
                {COLOR_KEYS.map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <input
                      type="color"
                      aria-label={t.brand.colorAriaLabel.replace("{color}", COLOR_LABELS[key])}
                      value={isValidHex(brandColors[key]) ? brandColors[key] : "#ffffff"}
                      onChange={(e) =>
                        setBrandColors({ ...brandColors, [key]: e.target.value })
                      }
                      className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-border/50 bg-background p-0.5"
                    />
                    <div className="flex-1 space-y-1">
                      <span className="text-sm text-muted-foreground">{COLOR_LABELS[key]}</span>
                      <Input
                        value={brandColors[key]}
                        onChange={(e) =>
                          setBrandColors({ ...brandColors, [key]: e.target.value })
                        }
                        maxLength={7}
                        className="bg-background border-border/60 focus:border-violet-500/50 font-mono text-sm transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            {success && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                <p className="text-sm text-green-700 dark:text-green-400">
                  {t.brand.savedSuccess}
                </p>
              </div>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? t.settings.saving : t.booking.saveChanges}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
