"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImageIcon, Check, X, Globe } from "lucide-react";
import { PREVIEW_GRADIENTS, GRADIENT_KEYS } from "@/lib/preview-gradients";
import { HashtagPicker } from "../HashtagPicker";
import { PreviewCropper } from "../PreviewCropper";
import { CONTENT_TYPES, getContentTypeLabel, getContentTypeDescription, type ContentTypeId } from "@/lib/spaces/content-types";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Space } from "@/lib/types";
import type { UseContentBuilderFormReturn } from "../../hooks/useContentBuilderForm";

interface ContentBuilderShellProps {
  contentType: ContentTypeId;
  space?: Space;
  form: UseContentBuilderFormReturn;
  /** Type-specific fields, rendered between Hashtags and Description. */
  children: React.ReactNode;
  /** Extra button in the preview toolbar, e.g. LinkBuilder's "Capture from URL". */
  previewCaptureAction?: React.ReactNode;
  /** All 6 creatable types keep the shared preview/gradient picker. */
  showPreviewSection?: boolean;
}

export function ContentBuilderShell({
  contentType,
  space,
  form,
  children,
  previewCaptureAction,
  showPreviewSection = true,
}: ContentBuilderShellProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const previewFileInputRef = useRef<HTMLInputElement>(null);
  const meta = CONTENT_TYPES[contentType];
  const Icon = meta.icon;
  const typeLabel = getContentTypeLabel(t, contentType);
  const typeDescription = getContentTypeDescription(t, contentType);

  const hasNewImage = !!form.previewImage && !!form.previewObjectUrl;
  const hasExistingImage = !!space?.preview_image_url && !form.clearExistingImage;
  const hasImage = hasNewImage || hasExistingImage;
  const gradient = PREVIEW_GRADIENTS[form.previewGradient];

  return (
    <Card className="w-full max-w-2xl shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Icon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-xl">
              {(form.isEditing ? t.contentBuilder.editTitle : t.contentBuilder.newTitle).replace(
                "{type}",
                typeLabel
              )}
            </CardTitle>
            <CardDescription>{typeDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit} className="space-y-6">
          {form.titleOptional && children}

          {!form.titleOptional && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="title" className="flex items-center gap-1.5">
                  {t.contentBuilder.titleLabel}
                  <span className="rounded-full bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    {t.contentBuilder.requiredBadge}
                  </span>
                </Label>
                <span className="text-xs text-muted-foreground">
                  {form.title.length}/{form.LIMITS.title}
                </span>
              </div>
              <Input
                id="title"
                placeholder={t.contentBuilder.titlePlaceholder}
                value={form.title}
                onChange={(e) => form.setTitle(e.target.value.slice(0, form.LIMITS.title))}
                maxLength={form.LIMITS.title}
                required
                aria-required="true"
                className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t.contentBuilder.hashtagsLabel}</Label>
            <p className="text-xs text-muted-foreground">{t.contentBuilder.hashtagsHint}</p>
            <HashtagPicker
              suggestions={form.hashtagSuggestions}
              selectedHashtags={form.selectedHashtags}
              onChange={form.setSelectedHashtags}
            />
          </div>

          {!form.titleOptional && children}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">{t.contentBuilder.descriptionLabel}</Label>
              <span
                className={`text-xs ${
                  form.description.length >= form.LIMITS.description ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {form.description.length}/{form.LIMITS.description}
              </span>
            </div>
            <Textarea
              id="description"
              placeholder={t.contentBuilder.descriptionPlaceholder}
              value={form.description}
              onChange={(e) => {
                const val = e.target.value;
                if (val.split("\n").length > form.LIMITS.descriptionLines) return;
                if (val.length > form.LIMITS.description) return;
                form.setDescription(val);
              }}
              rows={3}
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
          </div>

          {showPreviewSection && (
            <div className="space-y-3">
              <Label>{t.contentBuilder.previewLabel}</Label>

              {form.showCropper && form.generatedPreviewSrc ? (
                <PreviewCropper
                  imageSrc={form.generatedPreviewSrc}
                  onConfirm={form.handleCropConfirm}
                  onCancel={form.cleanupGeneratedPreview}
                />
              ) : (
                <>
                  {hasNewImage ? (
                    <div className="flex items-center gap-3 rounded-xl border border-violet-400/50 bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
                      <div className="relative w-16 h-10 rounded overflow-hidden shrink-0 border border-violet-300/50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={form.previewObjectUrl!} alt={t.contentBuilder.previewLabel} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-violet-700 dark:text-violet-300 truncate">
                          {form.previewImage!.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(form.previewImage!.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={form.removePreviewImage}
                        className="rounded-full p-1 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors shrink-0"
                        title={t.contentBuilder.removeImageAria}
                      >
                        <X className="h-4 w-4 text-violet-500" />
                      </button>
                    </div>
                  ) : hasExistingImage ? (
                    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                      <div className="relative w-16 h-10 rounded overflow-hidden shrink-0 border border-border/60">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={space!.preview_image_url!} alt={t.contentBuilder.currentPreviewImage} className="w-full h-full object-cover" />
                      </div>
                      <span className="flex-1 text-xs text-muted-foreground">{t.contentBuilder.currentPreviewImage}</span>
                      <button
                        type="button"
                        onClick={form.removePreviewImage}
                        className="rounded-full p-1 hover:bg-muted transition-colors shrink-0"
                        title={t.contentBuilder.removeImageAria}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {previewCaptureAction}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => previewFileInputRef.current?.click()}
                      className="gap-1.5 border-border/60"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {hasImage ? t.contentBuilder.replaceImage : t.contentBuilder.uploadImage}
                    </Button>
                    <input
                      ref={previewFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) form.setPreviewImageFile(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {form.screenshotError && <p className="text-xs text-muted-foreground">{form.screenshotError}</p>}

                  {!hasImage && (
                    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs font-medium text-foreground/70">{t.contentBuilder.backgroundColorLabel}</p>

                      <div className="flex gap-2 flex-wrap">
                        {GRADIENT_KEYS.map((key) => {
                          const g = PREVIEW_GRADIENTS[key];
                          const selected = form.previewGradient === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              title={g.label}
                              onClick={() => form.setPreviewGradient(key)}
                              className="relative h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              style={{ background: g.swatch }}
                            >
                              {selected && (
                                <span className="absolute inset-0 flex items-center justify-center">
                                  <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />
                                </span>
                              )}
                              {selected && (
                                <span className="absolute -inset-0.5 rounded-full ring-2 ring-offset-1 ring-offset-background ring-foreground/30" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground/70">
                          {t.contentBuilder.previewTitleLabel}{" "}
                          <span className="font-normal text-muted-foreground">({t.contentBuilder.optionalLabel})</span>
                        </p>
                        <input
                          type="text"
                          placeholder={t.contentBuilder.previewTitlePlaceholder}
                          value={form.previewTitle}
                          maxLength={64}
                          onChange={(e) => form.setPreviewTitle(e.target.value)}
                          className="w-full rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 focus:bg-background transition-colors placeholder:text-muted-foreground/50"
                        />
                      </div>

                      <div className="overflow-hidden rounded-lg aspect-video border border-border/40">
                        <div className={`flex h-full w-full items-center justify-center ${gradient.bg}`}>
                          {form.previewTitle.trim() ? (
                            <span className={`text-center text-2xl font-bold leading-tight px-3 line-clamp-3 ${gradient.text}`}>
                              {form.previewTitle}
                            </span>
                          ) : (
                            <span className={`text-2xl font-bold ${gradient.text}`}>
                              {form.title[0]?.toUpperCase() || "?"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {hasImage && <p className="text-xs text-muted-foreground">{t.contentBuilder.thumbnailHint}</p>}
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/50">
              <Switch
                id="isPublic"
                checked={form.isPublic}
                onCheckedChange={form.setIsPublic}
              />
              <Label htmlFor="isPublic" className="font-normal cursor-pointer">
                {t.contentBuilder.showOnProfileLabel}
              </Label>
            </div>
            {form.isPublic && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                <Globe className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {t.contentBuilder.publicNotice}
                </p>
              </div>
            )}
          </div>

          {form.spaceLimitReached && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{t.plan.spaceLimitTitle}</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                {t.plan.spaceLimitReached}
              </p>
              <Link
                href="/dashboard/credits"
                className="inline-flex items-center mt-2 text-sm font-semibold text-amber-900 dark:text-amber-200 underline underline-offset-2"
              >
                {t.plan.upgradeCta}
              </Link>
            </div>
          )}

          {form.error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{form.error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={form.loading || (!form.titleOptional && !form.title.trim())}>
              {form.loading
                ? t.contentBuilder.saving
                : form.isEditing
                ? t.contentBuilder.saveChanges
                : t.contentBuilder.createContent}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="border-border/60 hover:border-violet-500/50 transition-colors"
            >
              {t.common.cancel}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
