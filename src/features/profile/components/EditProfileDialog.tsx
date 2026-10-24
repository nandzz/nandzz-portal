"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Mail, Globe, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Profile, SocialLinks, ProfileAddress } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { updateProfileInfo } from "../actions/update-profile-info";
import { AddressAutocomplete } from "./AddressAutocomplete";
import {
  BUSINESS_CATEGORIES,
  businessCategoryLabel,
  isBusinessCategory,
} from "../domain/business-category";
import { useModalA11y } from "@/lib/useModalA11y";
import { Sheet, useSheetLayout } from "@/components/ui/sheet";
import {
  SOCIAL_VALUE_MAX,
  isValidSocialValue,
  isValidWebsiteUrl,
  normalizeSocialValue,
  normalizeWebsiteUrl,
  type SocialPlatform,
} from "../domain/social";
import {
  InstagramIcon,
  LinkedinIcon,
  XIcon,
  GithubIcon,
  YoutubeIcon,
} from "./BrandIcons";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import {
  PHONE_COUNTRIES,
  dialForRegion,
  inferPhoneRegion,
  isPossiblePhoneNumber,
  regionName,
  regionToFlag,
  splitE164,
  toE164,
} from "@/features/booking/domain/phone";

const LIMITS = {
  displayName: 50,
  tagline: 100,
  bio: 500,
  bioLines: 5,
  websiteUrl: 300,
  socialEmail: 254,
  socialPhone: 20,
};

interface EditProfileDialogProps {
  onClose: () => void;
  profile: Profile;
}

// Mounted only while open (see ProfileBackground), so useState initializers seed
// the form fresh from `profile` each time it opens — no re-seed effect needed.
// Phones get a bottom sheet, larger screens the centered dialog.
export function EditProfileDialog({ onClose, profile }: EditProfileDialogProps) {
  const { t, locale } = useLanguage();
  const sheet = useSheetLayout();
  // The sheet slides out before the parent unmounts us: flip `open`, and its
  // onClosed calls onClose. The desktop dialog closes instantly, as before.
  const [open, setOpen] = useState(true);
  const dismiss = () => (sheet ? setOpen(false) : onClose());
  // Rotating past the breakpoint mid-close swaps the sheet (and its onClosed)
  // for the dialog, so finish the close here instead of reopening as a dialog.
  useEffect(() => {
    if (!open && !sheet) onClose();
  }, [open, sheet, onClose]);

  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [tagline, setTagline] = useState(profile.tagline || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || "");
  const [address, setAddress] = useState<ProfileAddress | null>(profile.address ?? null);
  const isBusiness = profile.account_type === "business";
  const [category, setCategory] = useState(
    isBusinessCategory(profile.category) ? profile.category : ""
  );
  const categoryOptions = useMemo(
    () =>
      BUSINESS_CATEGORIES.map((c) => ({ id: c, label: businessCategoryLabel(c, locale) })).sort(
        (a, b) => (a.id === "other" ? 1 : b.id === "other" ? -1 : a.label.localeCompare(b.label, locale))
      ),
    [locale]
  );
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(profile.social_links || {});
  // WhatsApp is stored as E.164 in social_links.whatsapp but edited as country
  // selector + national number — same phone data/helpers as the booking widget.
  const [whatsappRegion, setWhatsappRegion] = useState(() =>
    profile.social_links?.whatsapp
      ? splitE164(profile.social_links.whatsapp).region
      : inferPhoneRegion(typeof navigator !== "undefined" ? navigator.language : null, locale)
  );
  const [whatsappNational, setWhatsappNational] = useState(() =>
    profile.social_links?.whatsapp ? splitE164(profile.social_links.whatsapp).national : ""
  );
  const phoneCountryOptions = useMemo(
    () =>
      [...PHONE_COUNTRIES].sort((a, b) =>
        regionName(a.region, locale).localeCompare(regionName(b.region, locale), locale)
      ),
    [locale]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<Set<string>>(new Set());

  const buildPayload = () => ({
    displayName: displayName.trim() || null,
    tagline: tagline.trim() || null,
    bio: bio.trim() || null,
    websiteUrl: normalizeWebsiteUrl(websiteUrl) || null,
    socialLinks: {
      ...(Object.fromEntries(
        Object.entries(socialLinks).map(([k, v]) => [
          k,
          k === "email" ? (v ?? "").trim() : normalizeSocialValue(k as SocialPlatform, v ?? ""),
        ])
      ) as SocialLinks),
      whatsapp: whatsappNational.trim()
        ? toE164(dialForRegion(whatsappRegion), whatsappNational)
        : "",
    } as SocialLinks,
    address,
    ...(isBusiness && category ? { category } : {}),
  });

  // Snapshot of the form as opened, to warn before discarding edits.
  const [initialPayload] = useState(() => JSON.stringify(buildPayload()));
  const isDirty = () => JSON.stringify(buildPayload()) !== initialPayload;

  // Never close mid-save (the result/error would be lost), and confirm before
  // throwing away unsaved edits (Escape / backdrop / X / Cancel).
  const requestClose = () => {
    if (loading) return;
    if (isDirty() && !window.confirm(t.common.discardChanges)) return;
    dismiss();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");

    const payload = buildPayload();
    const bad = new Set<string>();
    if (payload.websiteUrl && (payload.websiteUrl.length > LIMITS.websiteUrl || !isValidWebsiteUrl(payload.websiteUrl))) {
      bad.add("website");
    }
    for (const key of ["instagram", "linkedin", "twitter", "github", "youtube"] as const) {
      if (!isValidSocialValue(key, payload.socialLinks[key] ?? "")) bad.add(key);
    }
    const email = payload.socialLinks.email ?? "";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad.add("email");
    if (whatsappNational.trim() && !isPossiblePhoneNumber(whatsappNational)) bad.add("whatsapp");
    setInvalid(bad);
    if (bad.size > 0) {
      setError(bad.size === 1 && bad.has("whatsapp") ? t.booking.invalidPhone : t.common.checkHighlighted);
      return;
    }

    setLoading(true);
    try {
      // The action revalidates the public profile itself; its response brings
      // the fresh server render, so the header updates as the dialog closes.
      const result = await updateProfileInfo(payload);
      if (!result.ok) {
        setError(result.error === "INVALID_INPUT" ? t.common.checkHighlighted : t.common.error);
        return;
      }
      window.dispatchEvent(new CustomEvent("profile-updated"));
      dismiss();
    } catch (err: unknown) {
      console.error("[profile] update failed:", err);
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const invalidRing = (key: string) =>
    invalid.has(key) ? "border-destructive focus-within:border-destructive" : "border-border/60 focus-within:border-violet-500/50";

  const socialRows = [
    { key: "instagram", Icon: InstagramIcon, prefix: "instagram.com/", placeholder: "username" },
    { key: "linkedin", Icon: LinkedinIcon, prefix: "linkedin.com/in/", placeholder: "username" },
    { key: "twitter", Icon: XIcon, prefix: "x.com/", placeholder: "username" },
    { key: "github", Icon: GithubIcon, prefix: "github.com/", placeholder: "username" },
    { key: "youtube", Icon: YoutubeIcon, prefix: "youtube.com/@", placeholder: "channel" },
  ] as const;

  const content = (
    <>
      {/* Tighter on top in the sheet, under its grab handle. */}
      <div className="flex items-center justify-between px-6 pt-2 pb-4 sm:pt-4 border-b border-border/60">
        <h2 id="edit-profile-title" className="text-lg font-semibold">{t.settings.profileTitle}</h2>
        <button
          type="button"
          onClick={requestClose}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col overflow-hidden">
        <div className="scrollbar-hide space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="edit-displayName">{t.settings.displayName}</Label>
            <Input
              id="edit-displayName"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, LIMITS.displayName))}
              maxLength={LIMITS.displayName}
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-tagline">{t.settings.tagline}</Label>
              <span className="text-xs text-muted-foreground">{tagline.length}/{LIMITS.tagline}</span>
            </div>
            <Input
              id="edit-tagline"
              placeholder="e.g. Full-Stack Developer"
              value={tagline}
              onChange={(e) => setTagline(e.target.value.slice(0, LIMITS.tagline))}
              maxLength={LIMITS.tagline}
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-bio">{t.settings.bio}</Label>
              <span className={`text-xs ${bio.length >= LIMITS.bio ? "text-destructive" : "text-muted-foreground"}`}>
                {bio.length}/{LIMITS.bio}
              </span>
            </div>
            <Textarea
              id="edit-bio"
              placeholder="Tell the world about yourself..."
              value={bio}
              onChange={(e) => {
                const val = e.target.value;
                if (val.split("\n").length > LIMITS.bioLines) return;
                if (val.length > LIMITS.bio) return;
                setBio(val);
              }}
              rows={4}
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
            <p className="text-xs text-muted-foreground">
              {t.settings.bioHint.replace("{bio}", String(LIMITS.bio)).replace("{lines}", String(LIMITS.bioLines))}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-websiteUrl">{t.settings.websiteUrl}</Label>
            <div className={`flex items-center gap-0 rounded-md border bg-background overflow-hidden transition-colors ${invalidRing("website")}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border-r border-border/60 bg-muted/50 text-muted-foreground">
                <Globe className="h-4 w-4" />
              </span>
              <Input
                id="edit-websiteUrl"
                type="url"
                inputMode="url"
                autoCapitalize="none"
                placeholder="https://yourwebsite.com"
                value={websiteUrl}
                aria-invalid={invalid.has("website") || undefined}
                onChange={(e) => setWebsiteUrl(e.target.value.slice(0, LIMITS.websiteUrl))}
                onBlur={(e) => setWebsiteUrl(normalizeWebsiteUrl(e.target.value))}
                maxLength={LIMITS.websiteUrl}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          {isBusiness && (
            <div className="space-y-2">
              <Label htmlFor="edit-category">{t.nav.businessCategory}</Label>
              <div className="relative">
                <select
                  id="edit-category"
                  value={category}
                  onChange={(e) => setCategory(isBusinessCategory(e.target.value) ? e.target.value : "")}
                  className="h-9 w-full appearance-none rounded-md border border-border/60 bg-background pl-3 pr-8 text-base sm:text-sm focus:outline-none focus:border-violet-500/50 cursor-pointer"
                >
                  {/* Legacy businesses have none yet; once set it can't be cleared. */}
                  {!category && <option value="">—</option>}
                  {categoryOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-address">{t.settings.address}</Label>
            <AddressAutocomplete
              id="edit-address"
              value={address}
              onChange={setAddress}
              placeholder={t.settings.addressPlaceholder}
            />
            <p className="text-xs text-muted-foreground">{t.settings.addressHint}</p>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-semibold">{t.settings.socialLinks}</Label>

            <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
              {socialRows.map(({ key, Icon, prefix, placeholder }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className={`flex items-center gap-0 flex-1 min-w-0 rounded-md border bg-background overflow-hidden transition-colors ${invalidRing(key)}`}>
                    <span className="px-3 text-xs text-muted-foreground bg-muted/50 h-9 flex items-center border-r border-border/60 whitespace-nowrap">{prefix}</span>
                    {/* Pasting a full profile URL is fine: it's reduced to the
                        handle on blur/save (see domain/social), so long
                        LinkedIn/YouTube URLs aren't truncated into broken links. */}
                    <Input
                      placeholder={placeholder}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label={prefix}
                      aria-invalid={invalid.has(key) || undefined}
                      value={socialLinks[key as keyof SocialLinks] || ""}
                      onChange={(e) =>
                        setSocialLinks({ ...socialLinks, [key]: e.target.value.slice(0, SOCIAL_VALUE_MAX) })
                      }
                      onBlur={(e) =>
                        setSocialLinks({ ...socialLinks, [key]: normalizeSocialValue(key, e.target.value) })
                      }
                      maxLength={SOCIAL_VALUE_MAX}
                      className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 text-muted-foreground">
                  <WhatsAppIcon className="h-4 w-4" />
                </div>
                <div className={`flex items-center gap-0 flex-1 min-w-0 rounded-md border bg-background overflow-hidden transition-colors ${invalidRing("whatsapp")}`}>
                  {/* Country dial-code selector in place of the static prefix. */}
                  <div className="relative shrink-0 h-9 border-r border-border/60 bg-muted/50">
                    <select
                      aria-label={t.booking.phoneCountryAria}
                      value={whatsappRegion}
                      onChange={(e) => setWhatsappRegion(e.target.value)}
                      className="h-full appearance-none bg-transparent pl-3 pr-7 text-base sm:text-xs text-muted-foreground focus:outline-none cursor-pointer"
                    >
                      {phoneCountryOptions.map((c) => (
                        <option key={c.region} value={c.region}>
                          {regionToFlag(c.region)} +{c.dial}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="WhatsApp"
                    value={whatsappNational}
                    onChange={(e) => setWhatsappNational(e.target.value.slice(0, LIMITS.socialPhone))}
                    maxLength={LIMITS.socialPhone}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                </div>
                <Input
                  type="email"
                  autoCapitalize="none"
                  aria-label="Email"
                  aria-invalid={invalid.has("email") || undefined}
                  placeholder="you@example.com"
                  value={socialLinks.email || ""}
                  onChange={(e) =>
                    setSocialLinks({ ...socialLinks, email: e.target.value.slice(0, LIMITS.socialEmail) })
                  }
                  maxLength={LIMITS.socialEmail}
                  className={`bg-background transition-colors ${invalid.has("email") ? "border-destructive" : "border-border/60 focus:border-violet-500/50"}`}
                />
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border/60 px-6 py-4">
          <Button type="button" variant="outline" size="sm" onClick={requestClose} disabled={loading}>
            {t.settings.deleteDialogCancel}
          </Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? t.settings.saving : t.settings.saveChanges}
          </Button>
        </div>
      </form>
    </>
  );

  if (sheet) {
    return (
      <Sheet
        open={open}
        onOpenChange={(next) => { if (!next) requestClose(); }}
        onClosed={onClose}
        aria-labelledby="edit-profile-title"
      >
        {content}
      </Sheet>
    );
  }
  if (!open) return null;
  return <CenteredDialog onRequestClose={requestClose}>{content}</CenteredDialog>;
}

// The desktop presentation: hand-rolled portal modal (useModalA11y does focus,
// Escape and scroll lock), unchanged from before the mobile sheet.
function CenteredDialog({ onRequestClose, children }: { onRequestClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModalA11y(panelRef, onRequestClose);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onRequestClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="relative z-10 w-full max-w-lg mx-4 max-h-[90dvh] flex flex-col"
      >
        <div className="bg-background border border-border/60 rounded-xl shadow-xl flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
