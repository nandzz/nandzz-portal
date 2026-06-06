"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Camera,
  Briefcase,
  AtSign,
  Code,
  Mail,
  Video,
  User,
  ShieldCheck,
  CreditCard,
  Trash2,
  Globe,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { FEATURES } from "@/lib/flags";
import { AvatarCropModal } from "@/components/ui/AvatarCropModal";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { PhoneVerificationForm } from "@/components/auth/PhoneVerificationForm";
import type { Profile, SocialLinks } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORTED_LOCALES, LOCALE_LABELS } from "@/lib/i18n/translations";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t, locale, setLocale } = useLanguage();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || "");
        setTagline(data.tagline || "");
        setBio(data.bio || "");
        setWebsiteUrl(data.website_url || "");
        setSocialLinks(data.social_links || {});
      }
    };
    loadProfile();
  }, [supabase, router]);

  const LIMITS = {
    displayName: 50,
    tagline: 100,
    bio: 500,
    bioLines: 5,
    websiteUrl: 300,
    socialUsername: 50,
    socialEmail: 254,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (displayName.length > LIMITS.displayName) {
        setError(`Display name must be ${LIMITS.displayName} characters or less`);
        setLoading(false);
        return;
      }
      if (tagline.length > LIMITS.tagline) {
        setError(`Tagline must be ${LIMITS.tagline} characters or less`);
        setLoading(false);
        return;
      }
      if (bio.length > LIMITS.bio) {
        setError(`Bio must be ${LIMITS.bio} characters or less`);
        setLoading(false);
        return;
      }
      if (websiteUrl && websiteUrl.length > LIMITS.websiteUrl) {
        setError(`Website URL must be ${LIMITS.websiteUrl} characters or less`);
        setLoading(false);
        return;
      }
      if (websiteUrl && !/^https?:\/\//i.test(websiteUrl)) {
        setError("Website URL must start with http:// or https://");
        setLoading(false);
        return;
      }

      let avatar_url = profile?.avatar_url || null;

      if (avatarFile) {
        const filePath = `${user.id}/avatar.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true, contentType: "image/jpeg" });

        if (uploadError) {
          setError("Failed to upload avatar: " + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);
        avatar_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: displayName || null,
          tagline: tagline || null,
          bio: bio || null,
          website_url: websiteUrl || null,
          social_links: socialLinks,
          avatar_url,
        })
        .eq("id", user.id);

      if (error) throw error;

      await fetch("/api/profile/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: profile?.username }),
      });

      setSuccess(true);
      window.dispatchEvent(new CustomEvent("profile-updated"));
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        setDeleteError(body.error || "Failed to delete account");
        return;
      }
      await supabase.auth.signOut();
      router.push("/");
    } catch {
      setDeleteError("Something went wrong. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          <p className="text-muted-foreground text-sm">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)]">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute right-0 top-0 h-[300px] w-[300px] rounded-full bg-violet-100/30 blur-3xl dark:bg-violet-950/15" />
      </div>

      <div className="mx-auto flex max-w-7xl justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <Tabs defaultValue="profile" className="gap-6">
            <TabsList className="w-full">
              <TabsTrigger value="profile" className="flex-1 gap-2">
                <User className="h-4 w-4" />
                {t.settings.tabProfile}
              </TabsTrigger>
              <TabsTrigger value="security" className="flex-1 gap-2">
                <ShieldCheck className="h-4 w-4" />
                {t.settings.tabSecurity}
              </TabsTrigger>
              {FEATURES.monetization && (
                <TabsTrigger value="billing" className="flex-1 gap-2">
                  <CreditCard className="h-4 w-4" />
                  {t.settings.tabBilling}
                </TabsTrigger>
              )}
              <TabsTrigger value="preferences" className="flex-1 gap-2">
                <Globe className="h-4 w-4" />
                {t.settings.tabPreferences}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
            <Card className="w-full shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">{t.settings.profileTitle}</CardTitle>
            <CardDescription>
              {t.settings.profileDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/50">
                <Avatar className="h-16 w-16 border-2 border-violet-200 dark:border-violet-800">
                  <AvatarImage
                    src={
                      avatarFile
                        ? URL.createObjectURL(avatarFile)
                        : profile.avatar_url || undefined
                    }
                  />
                  <AvatarFallback className="text-xl bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                    {profile.display_name?.[0]?.toUpperCase() ||
                      profile.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1.5 flex-1">
                  <Label className="font-medium">
                    {t.settings.profilePicture}
                  </Label>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png, image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 1.5 * 1024 * 1024) {
                        setError("Profile picture must be under 1.5 MB");
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
                    onClick={() => avatarInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                  >
                    {t.settings.chooseImage}
                  </button>
                  {avatarFile && (
                    <p className="text-xs text-violet-600 dark:text-violet-400">
                      {t.settings.newPictureReady}
                    </p>
                  )}
                </div>
              </div>

              {cropImageSrc && (
                <AvatarCropModal
                  imageSrc={cropImageSrc}
                  onCancel={() => setCropImageSrc(null)}
                  onCrop={(blob) => {
                    setAvatarFile(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
                    setCropImageSrc(null);
                  }}
                />
              )}

              <div className="space-y-2">
                <Label>{t.settings.username}</Label>
                <Input
                  value={profile.username}
                  disabled
                  className="bg-muted/50"
                />
                <p className="text-xs text-muted-foreground">
                  {t.settings.usernameHint}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">{t.settings.displayName}</Label>
                <Input
                  id="displayName"
                  placeholder="Your display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, LIMITS.displayName))}
                  maxLength={LIMITS.displayName}
                  className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tagline">{t.settings.tagline}</Label>
                  <span className="text-xs text-muted-foreground">{tagline.length}/{LIMITS.tagline}</span>
                </div>
                <Input
                  id="tagline"
                  placeholder="e.g. Full-Stack Developer"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value.slice(0, LIMITS.tagline))}
                  maxLength={LIMITS.tagline}
                  className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio">{t.settings.bio}</Label>
                  <span className={`text-xs ${bio.length >= LIMITS.bio ? "text-destructive" : "text-muted-foreground"}`}>
                    {bio.length}/{LIMITS.bio}
                  </span>
                </div>
                <Textarea
                  id="bio"
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
                <Label htmlFor="websiteUrl">{t.settings.websiteUrl}</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value.slice(0, LIMITS.websiteUrl))}
                  maxLength={LIMITS.websiteUrl}
                  className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
                />
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">{t.settings.socialLinks}</Label>

                <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-0 flex-1 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
                      <span className="px-3 text-xs text-muted-foreground bg-muted/50 h-9 flex items-center border-r border-border/60 whitespace-nowrap">instagram.com/</span>
                      <Input
                        placeholder="username"
                        value={socialLinks.instagram || ""}
                        onChange={(e) =>
                          setSocialLinks({
                            ...socialLinks,
                            instagram: e.target.value.slice(0, LIMITS.socialUsername),
                          })
                        }
                        maxLength={LIMITS.socialUsername}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-0 flex-1 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
                      <span className="px-3 text-xs text-muted-foreground bg-muted/50 h-9 flex items-center border-r border-border/60 whitespace-nowrap">linkedin.com/in/</span>
                      <Input
                        placeholder="username"
                        value={socialLinks.linkedin || ""}
                        onChange={(e) =>
                          setSocialLinks({
                            ...socialLinks,
                            linkedin: e.target.value.slice(0, LIMITS.socialUsername),
                          })
                        }
                        maxLength={LIMITS.socialUsername}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                      <AtSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-0 flex-1 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
                      <span className="px-3 text-xs text-muted-foreground bg-muted/50 h-9 flex items-center border-r border-border/60 whitespace-nowrap">x.com/</span>
                      <Input
                        placeholder="username"
                        value={socialLinks.twitter || ""}
                        onChange={(e) =>
                          setSocialLinks({
                            ...socialLinks,
                            twitter: e.target.value.slice(0, LIMITS.socialUsername),
                          })
                        }
                        maxLength={LIMITS.socialUsername}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                      <Code className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-0 flex-1 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
                      <span className="px-3 text-xs text-muted-foreground bg-muted/50 h-9 flex items-center border-r border-border/60 whitespace-nowrap">github.com/</span>
                      <Input
                        placeholder="username"
                        value={socialLinks.github || ""}
                        onChange={(e) =>
                          setSocialLinks({
                            ...socialLinks,
                            github: e.target.value.slice(0, LIMITS.socialUsername),
                          })
                        }
                        maxLength={LIMITS.socialUsername}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      value={socialLinks.email || ""}
                      onChange={(e) =>
                        setSocialLinks({
                          ...socialLinks,
                          email: e.target.value.slice(0, LIMITS.socialEmail),
                        })
                      }
                      maxLength={LIMITS.socialEmail}
                      className="bg-background border-border/60 focus:border-violet-500/50 transition-colors"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background border border-border/50">
                      <Video className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-0 flex-1 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
                      <span className="px-3 text-xs text-muted-foreground bg-muted/50 h-9 flex items-center border-r border-border/60 whitespace-nowrap">youtube.com/@</span>
                      <Input
                        placeholder="channel"
                        value={socialLinks.youtube || ""}
                        onChange={(e) =>
                          setSocialLinks({
                            ...socialLinks,
                            youtube: e.target.value.slice(0, LIMITS.socialUsername),
                          })
                        }
                        maxLength={LIMITS.socialUsername}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
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
                    {t.settings.savedSuccess}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? t.settings.saving : t.settings.saveChanges}
              </Button>
            </form>
          </CardContent>
        </Card>
            </TabsContent>

            <TabsContent value="security">
              <div className="space-y-6">
                <Card className="w-full shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{t.settings.securityPasswordTitle}</CardTitle>
                    <CardDescription>{t.settings.securityPasswordDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChangePasswordForm />
                  </CardContent>
                </Card>

                <Card className="w-full shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{t.settings.securityPhoneTitle}</CardTitle>
                    <CardDescription>
                      {t.settings.securityPhoneDesc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PhoneVerificationForm />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {FEATURES.monetization && (
              <TabsContent value="billing">
                <Card className="w-full shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{t.settings.billingTitle}</CardTitle>
                    <CardDescription>{t.settings.billingDesc}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {t.settings.billingPageDesc}
                    </p>
                    <div className="flex gap-3">
                      <a href="/dashboard/billing">
                        <button className="inline-flex items-center gap-2 rounded-md bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-medium shadow-sm shadow-violet-600/25 transition-colors">
                          <CreditCard className="h-4 w-4" />
                          {t.settings.billingViewPage}
                        </button>
                      </a>
                      <a href="/pricing">
                        <button className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background hover:bg-accent px-4 py-2 text-sm font-medium transition-colors">
                          {t.settings.billingViewPlans}
                        </button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="preferences">
              <Card className="w-full shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{t.settings.preferencesTitle}</CardTitle>
                  <CardDescription>{t.settings.preferencesDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm font-medium">{t.settings.languageLabel}</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.settings.languageHint}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {SUPPORTED_LOCALES.map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setLocale(lang)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                            locale === lang
                              ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-500/70"
                              : "border-border/60 bg-background hover:bg-accent hover:border-border text-foreground"
                          }`}
                        >
                          <span className="text-base leading-none">
                            {lang === "en" && "🇬🇧"}
                            {lang === "pt" && "🇧🇷"}
                            {lang === "fr" && "🇫🇷"}
                            {lang === "es" && "🇪🇸"}
                            {lang === "ja" && "🇯🇵"}
                            {lang === "de" && "🇩🇪"}
                            {lang === "it" && "🇮🇹"}
                          </span>
                          {LOCALE_LABELS[lang]}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Danger Zone */}
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-destructive">{t.settings.deleteAccountTitle}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.settings.deleteAccountDesc}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setDeleteDialogOpen(true);
                  setDeleteConfirm("");
                  setDeleteError("");
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t.settings.deleteAccountButton}
              </Button>
            </div>
          </div>

          <Dialog
            open={deleteDialogOpen}
            onClose={() => setDeleteDialogOpen(false)}
            title={t.settings.deleteDialogTitle}
          >
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const [before, after] = t.settings.deleteDialogDesc.split("{username}");
                  return <>{before}<span className="font-mono font-semibold text-foreground">{profile.username}</span>{after}</>;
                })()}
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={profile.username}
                className="w-full rounded-md border border-border/60 bg-muted/50 px-3 py-2 text-sm focus:border-destructive/50 focus:outline-none focus:ring-1 focus:ring-destructive/30"
              />
              {deleteError && (
                <p className="text-sm text-destructive">{deleteError}</p>
              )}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deleteLoading}
                >
                  {t.settings.deleteDialogCancel}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleteConfirm !== profile.username || deleteLoading}
                  onClick={handleDeleteAccount}
                >
                  {deleteLoading ? t.settings.deleting : t.settings.deleteDialogConfirm}
                </Button>
              </div>
            </div>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
