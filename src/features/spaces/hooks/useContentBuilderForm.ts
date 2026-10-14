"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { publishSpace, type PublishSpacePayload } from "../actions/publish-space";
import { updateSpace } from "../actions/update-space";
import { revalidateContents } from "../actions/revalidate-contents";
import { loadHashtagSuggestions } from "../actions/load-hashtag-suggestions";
import {
  getCurrentUserId,
  uploadSpacePreviewImage,
  removeSpacePreviewByUrl,
} from "../storage";
import { DEFAULT_GRADIENT, type GradientKey } from "@/lib/preview-gradients";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Space } from "@/lib/types";
import type { ContentTypeId } from "@/lib/spaces/content-types";
import type { BuildTypePayloadContext } from "../components/builders/types";

const MAX_PREVIEW_IMAGE_SIZE = 1.5 * 1024 * 1024;

/** Limits for the fields the shared shell renders (title/description). Each
 * builder owns the limits for its own type-specific fields (url length, etc). */
export const SHARED_LIMITS = {
  title: 100,
  description: 300,
  descriptionLines: 5,
} as const;

export interface UseContentBuilderFormParams {
  /** The 6 creatable types, or "html" for the metadata-only legacy editor
   * (MetadataOnlyEditor) — that one never creates, only edits in place. */
  contentType: ContentTypeId;
  space?: Space;
  collectionId?: string;
  /** Per-type validation, run after the shared title/description checks. Return an error message, or null if valid. */
  validate: () => string | null;
  /** Uploads any type-specific file(s) and returns the columns to merge into the final payload. */
  buildTypePayload: (ctx: BuildTypePayloadContext) => Promise<Record<string, unknown>>;
}

export interface UseContentBuilderFormReturn {
  isEditing: boolean;
  /** Images have no title (caption + hashtags only). */
  titleOptional: boolean;
  LIMITS: typeof SHARED_LIMITS;

  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;

  hashtagSuggestions: string[];
  selectedHashtags: string[];
  setSelectedHashtags: (v: string[]) => void;

  isPublic: boolean;
  setIsPublic: (v: boolean) => void;

  loading: boolean;
  error: string;
  setError: (msg: string) => void;
  spaceLimitReached: boolean;

  previewImage: File | null;
  previewObjectUrl: string | null;
  clearExistingImage: boolean;
  setPreviewImageFile: (file: File) => void;
  removePreviewImage: () => void;

  previewGradient: GradientKey;
  setPreviewGradient: (g: GradientKey) => void;
  previewTitle: string;
  setPreviewTitle: (v: string) => void;

  generatedPreviewSrc: string | null;
  showCropper: boolean;
  isGenerating: boolean;
  screenshotError: string | null;
  captureFromUrl: (url: string) => Promise<void>;
  fetchUrlPreview: (url: string) => Promise<void>;
  clearScreenshotError: () => void;
  handleCropConfirm: (blob: Blob) => void;
  cleanupGeneratedPreview: () => void;

  handleSubmit: (e: React.FormEvent) => Promise<void>;
}

export function useContentBuilderForm({
  contentType,
  space,
  collectionId,
  validate,
  buildTypePayload,
}: UseContentBuilderFormParams): UseContentBuilderFormReturn {
  const router = useRouter();
  const { t } = useLanguage();
  const isEditing = !!space;
  const titleOptional = contentType === "image";

  const [title, setTitle] = useState(space?.title || "");
  const [description, setDescription] = useState(space?.description || "");
  const [isPublic, setIsPublic] = useState(space?.is_public ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [spaceLimitReached, setSpaceLimitReached] = useState(false);

  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>(space?.hashtags ?? []);

  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [clearExistingImage, setClearExistingImage] = useState(false);
  const [previewGradient, setPreviewGradient] = useState<GradientKey>(
    (space?.preview_gradient as GradientKey) || DEFAULT_GRADIENT
  );
  const [previewTitle, setPreviewTitle] = useState(space?.preview_title || "");

  const [generatedPreviewSrc, setGeneratedPreviewSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const generatedBlobUrlRef = useRef<string | null>(null);

  // Stable per-mount idempotency token — retried submits resolve to the same space row.
  const clientRequestIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    loadHashtagSuggestions().then(setHashtagSuggestions);
  }, []);

  // Track object URL for preview image thumbnail
  useEffect(() => {
    if (!previewImage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on file-clear; mirrors the pre-existing SpaceForm.tsx pattern.
      setPreviewObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewImage);
    setPreviewObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewImage]);

  // Cleanup generated blob URL on unmount
  useEffect(() => {
    return () => {
      if (generatedBlobUrlRef.current) URL.revokeObjectURL(generatedBlobUrlRef.current);
    };
  }, []);

  const cleanupGeneratedPreview = () => {
    if (generatedBlobUrlRef.current) {
      URL.revokeObjectURL(generatedBlobUrlRef.current);
      generatedBlobUrlRef.current = null;
    }
    setGeneratedPreviewSrc(null);
    setShowCropper(false);
  };

  const handleCropConfirm = (blob: Blob) => {
    const file = new File([blob], "preview.jpg", { type: "image/jpeg" });
    setPreviewImage(file);
    cleanupGeneratedPreview();
    setScreenshotError(null);
  };

  /** Captures a screenshot preview for an external URL via /api/screenshot. Used by LinkBuilder. */
  const captureFromUrl = async (rawUrl: string) => {
    const target = rawUrl.trim();
    if (!target) return;
    const normalized = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    setIsGenerating(true);
    setScreenshotError(null);
    try {
      const res = await fetch(`/api/screenshot?url=${encodeURIComponent(normalized)}`);
      if (!res.ok) throw new Error("Could not capture screenshot");
      const blob = await res.blob();
      if (blob.size < 1000) throw new Error("Empty response");
      if (generatedBlobUrlRef.current) URL.revokeObjectURL(generatedBlobUrlRef.current);
      const src = URL.createObjectURL(blob);
      generatedBlobUrlRef.current = src;
      setGeneratedPreviewSrc(src);
      setShowCropper(true);
    } catch {
      setScreenshotError(t.contentBuilder.linkScreenshotFailed);
    } finally {
      setIsGenerating(false);
    }
  };

  /** Auto-derives a preview for an external URL (OG image → screenshot fallback)
   * and sets it directly as the preview — no cropper. Used by LinkBuilder to
   * show a preview the moment a link is pasted. */
  const fetchUrlPreview = async (rawUrl: string) => {
    const target = rawUrl.trim();
    if (!target) return;
    const normalized = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    setIsGenerating(true);
    setScreenshotError(null);
    try {
      const res = await fetch(`/api/screenshot?url=${encodeURIComponent(normalized)}`);
      if (!res.ok) throw new Error("Could not fetch preview");
      const blob = await res.blob();
      if (blob.size < 1000) throw new Error("Empty response");
      const file = new File([blob], "preview.jpg", { type: blob.type || "image/jpeg" });
      setPreviewImage(file);
      setClearExistingImage(false);
    } catch {
      setScreenshotError(t.contentBuilder.linkScreenshotFailed);
    } finally {
      setIsGenerating(false);
    }
  };

  const clearScreenshotError = () => setScreenshotError(null);

  const setPreviewImageFile = (file: File) => {
    setPreviewImage(file);
    setClearExistingImage(false);
  };

  const removePreviewImage = () => {
    setPreviewImage(null);
    setClearExistingImage(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSpaceLimitReached(false);
    setLoading(true);

    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        setError(t.contentBuilder.mustBeLoggedIn);
        setLoading(false);
        return;
      }

      if (!titleOptional && !title.trim()) {
        setError(t.contentBuilder.titleRequiredError);
        setLoading(false);
        return;
      }
      if (title.length > SHARED_LIMITS.title) {
        setError(t.contentBuilder.titleTooLongError.replace("{max}", String(SHARED_LIMITS.title)));
        setLoading(false);
        return;
      }
      if (description.length > SHARED_LIMITS.description) {
        setError(t.contentBuilder.descriptionTooLongError.replace("{max}", String(SHARED_LIMITS.description)));
        setLoading(false);
        return;
      }

      const typeError = validate();
      if (typeError) {
        setError(typeError);
        setLoading(false);
        return;
      }

      if (previewImage && previewImage.size > MAX_PREVIEW_IMAGE_SIZE) {
        setError(t.contentBuilder.previewImageTooLarge);
        setLoading(false);
        return;
      }

      let preview_image_url = clearExistingImage && !previewImage ? null : space?.preview_image_url || null;

      // Delete old preview image when replacing or removing
      if (space?.preview_image_url && (previewImage || clearExistingImage)) {
        await removeSpacePreviewByUrl(space.preview_image_url);
      }

      // Upload preview image if provided
      if (previewImage) {
        try {
          preview_image_url = await uploadSpacePreviewImage(userId, previewImage);
        } catch (uploadErr) {
          console.error("[content-builder] preview upload failed:", uploadErr);
          setError(t.contentBuilder.genericError);
          setLoading(false);
          return;
        }
      }

      const hasManualPreview = !!previewImage || (!!space?.preview_image_url && !clearExistingImage);
      const typePayload = await buildTypePayload({ userId, title, hasManualPreview });

      // A builder may suggest a derived preview (uploaded content image, video
      // thumbnail, …) via `preview_image_url` in its payload — only used as a
      // fallback when the user hasn't picked/kept a preview of their own.
      if (!hasManualPreview && typeof typePayload.preview_image_url === "string") {
        preview_image_url = typePayload.preview_image_url;
      }

      const spaceData = {
        ...typePayload,
        content_type: contentType,
        title: title.trim(),
        description: description || null,
        preview_image_url,
        preview_gradient: previewGradient,
        preview_title: previewTitle.trim() || null,
        is_public: isPublic,
        user_id: userId,
        hashtags: selectedHashtags,
      };

      if (isEditing && space) {
        // Edits don't cost credits — a plain RLS-guarded update action, not
        // publish_space_tx. user_id stays on the row from creation; no need to
        // re-send it.
        const { user_id: _omit, ...updatePayload } = spaceData;
        void _omit;
        const result = await updateSpace({ id: space.id, ...updatePayload });
        if (!result.ok) throw new Error(result.message || result.error);
        await revalidateContents();
        router.push(collectionId ? `/dashboard/collections/${collectionId}` : "/dashboard/contents");
        return;
      } else {
        // First-time publish goes through the server action so credits are deducted atomically.
        // On success the action calls redirect() — nothing is returned, and control
        // won't reach the code below because Next.js navigates before resolving.
        const { user_id: _omit, ...publishPayload } = spaceData;
        void _omit;
        const result = await publishSpace(
          publishPayload as unknown as PublishSpacePayload,
          clientRequestIdRef.current,
          collectionId
        );
        // Only error results come back; success redirects server-side.
        if (result && !result.ok) {
          if (result.error === "SPACE_LIMIT_REACHED") {
            setSpaceLimitReached(true);
            setError("");
            return;
          }
          throw new Error(result.message || result.error);
        }
      }
    } catch (err: unknown) {
      // Let framework control-flow errors (redirect, notFound, …) propagate so
      // Next.js can handle the navigation instead of us swallowing them.
      unstable_rethrow(err);
      // Never surface the raw Supabase message/details/hint to the user — those
      // leak DB internals and are un-localized. Log the raw error, show generic.
      console.error("[content-builder] save failed:", err);
      setError(t.contentBuilder.genericError);
    } finally {
      setLoading(false);
    }
  };

  return {
    isEditing,
    titleOptional,
    LIMITS: SHARED_LIMITS,
    title,
    setTitle,
    description,
    setDescription,
    hashtagSuggestions,
    selectedHashtags,
    setSelectedHashtags,
    isPublic,
    setIsPublic,
    loading,
    error,
    setError,
    spaceLimitReached,
    previewImage,
    previewObjectUrl,
    clearExistingImage,
    setPreviewImageFile,
    removePreviewImage,
    previewGradient,
    setPreviewGradient,
    previewTitle,
    setPreviewTitle,
    generatedPreviewSrc,
    showCropper,
    isGenerating,
    screenshotError,
    captureFromUrl,
    fetchUrlPreview,
    clearScreenshotError,
    handleCropConfirm,
    cleanupGeneratedPreview,
    handleSubmit,
  };
}
