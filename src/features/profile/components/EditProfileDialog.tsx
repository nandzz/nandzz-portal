"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@/lib/widgets/phone";

const LIMITS = {
  displayName: 50,
  tagline: 100,
  bio: 500,
  bioLines: 5,
  websiteUrl: 300,
  socialUsername: 50,
  socialEmail: 254,
  socialPhone: 20,
};

interface EditProfileDialogProps {
  onClose: () => void;
  profile: Profile;
}

// Mounted only while open (see ProfileBackground), so useState initializers seed
// the form fresh from `profile` each time it opens — no re-seed effect needed.
export function EditProfileDialog({ onClose, profile }: EditProfileDialogProps) {
  const router = useRouter();
  const { t, locale } = useLanguage();

  const [displayName, setDisplayName] = useState(profile.display_name || "");
  const [tagline, setTagline] = useState(profile.tagline || "");
  const [bio, setBio] = useState(profile.bio || "");
  const [websiteUrl, setWebsiteUrl] = useState(profile.website_url || "");
  const [address, setAddress] = useState<ProfileAddress | null>(profile.address ?? null);
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

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (displayName.length > LIMITS.displayName) {
        setError(`Display name must be ${LIMITS.displayName} characters or less`);
        return;
      }
      if (tagline.length > LIMITS.tagline) {
        setError(`Tagline must be ${LIMITS.tagline} characters or less`);
        return;
      }
      if (bio.length > LIMITS.bio) {
        setError(`Bio must be ${LIMITS.bio} characters or less`);
        return;
      }
      if (websiteUrl && websiteUrl.length > LIMITS.websiteUrl) {
        setError(`Website URL must be ${LIMITS.websiteUrl} characters or less`);
        return;
      }
      if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
        setError("Website URL must start with http:// or https://");
        return;
      }
      if (whatsappNational.trim() && !isPossiblePhoneNumber(whatsappNational)) {
        setError(t.booking.invalidPhone);
        return;
      }

      const result = await updateProfileInfo({
        displayName: displayName || null,
        tagline: tagline || null,
        bio: bio || null,
        websiteUrl: websiteUrl || null,
        socialLinks: {
          ...socialLinks,
          whatsapp: whatsappNational.trim()
            ? toE164(dialForRegion(whatsappRegion), whatsappNational)
            : "",
        },
        address,
      });

      if (!result.ok) throw new Error(result.message || "Something went wrong");

      await fetch("/api/profile/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: profile.username }),
      });

      window.dispatchEvent(new CustomEvent("profile-updated"));
      router.refresh();
      onClose();
    } catch (err: unknown) {
      console.error("[profile] update failed:", err);
      setError(t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const socialRows = [
    { key: "instagram", Icon: InstagramIcon, prefix: "instagram.com/", placeholder: "username", max: LIMITS.socialUsername },
    { key: "linkedin", Icon: LinkedinIcon, prefix: "linkedin.com/in/", placeholder: "username", max: LIMITS.socialUsername },
    { key: "twitter", Icon: XIcon, prefix: "x.com/", placeholder: "username", max: LIMITS.socialUsername },
    { key: "github", Icon: GithubIcon, prefix: "github.com/", placeholder: "username", max: LIMITS.socialUsername },
    { key: "youtube", Icon: YoutubeIcon, prefix: "youtube.com/@", placeholder: "channel", max: LIMITS.socialUsername },
  ] as const;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="bg-background border border-border/60 rounded-xl shadow-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
            <h2 className="text-lg font-semibold">{t.settings.profileTitle}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
            <div className="space-y-5 overflow-y-auto px-6 py-5">
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
                <div className="flex items-center gap-0 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border-r border-border/60 bg-muted/50 text-muted-foreground">
                    <Globe className="h-4 w-4" />
                  </span>
                  <Input
                    id="edit-websiteUrl"
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value.slice(0, LIMITS.websiteUrl))}
                    maxLength={LIMITS.websiteUrl}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
              </div>

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
                  {socialRows.map(({ key, Icon, prefix, placeholder, max }) => (
                    <div key={key} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-0 flex-1 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
                        <span className="px-3 text-xs text-muted-foreground bg-muted/50 h-9 flex items-center border-r border-border/60 whitespace-nowrap">{prefix}</span>
                        <Input
                          placeholder={placeholder}
                          value={socialLinks[key as keyof SocialLinks] || ""}
                          onChange={(e) =>
                            setSocialLinks({ ...socialLinks, [key]: e.target.value.slice(0, max) })
                          }
                          maxLength={max}
                          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50 text-muted-foreground">
                      <WhatsAppIcon className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-0 flex-1 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
                      {/* Country dial-code selector in place of the static prefix. */}
                      <div className="relative shrink-0 h-9 border-r border-border/60 bg-muted/50">
                        <select
                          aria-label={t.booking.phoneCountryAria}
                          value={whatsappRegion}
                          onChange={(e) => setWhatsappRegion(e.target.value)}
                          className="h-full appearance-none bg-transparent pl-3 pr-7 text-xs text-muted-foreground focus:outline-none cursor-pointer"
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
                      placeholder="you@example.com"
                      value={socialLinks.email || ""}
                      onChange={(e) =>
                        setSocialLinks({ ...socialLinks, email: e.target.value.slice(0, LIMITS.socialEmail) })
                      }
                      maxLength={LIMITS.socialEmail}
                      className="bg-background border-border/60 focus:border-violet-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-border/60 px-6 py-4">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
                {t.settings.deleteDialogCancel}
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? t.settings.saving : t.settings.saveChanges}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
