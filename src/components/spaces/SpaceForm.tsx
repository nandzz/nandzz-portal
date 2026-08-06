"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { publishSpace } from "@/lib/actions/publish-space";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Code,
  Globe,
  Rocket,
  UploadCloud,
  FileCode2,
  FileText,
  X,
  Wand2,
  ImageIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Video,
  AlignLeft,
  Sparkles,
} from "lucide-react";
import { PREVIEW_GRADIENTS, GRADIENT_KEYS, DEFAULT_GRADIENT, type GradientKey } from "@/lib/preview-gradients";
import { HashtagPicker } from "./HashtagPicker";
import { PreviewCropper } from "./PreviewCropper";
import type { Space } from "@/lib/types";
import { sandboxHtml } from "@/lib/sandbox-html";
import { detectVideo, getYoutubeThumbnail, getVimeoThumbnail } from "./VideoEmbed";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type SpaceMode = "html" | "url" | "pdf" | "image" | "video" | "markdown" | "ai";

/** Render HTML in a hidden iframe and capture a screenshot using html2canvas */
async function captureHtmlScreenshot(
  htmlContent: string
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "1024px";
    iframe.style.height = "768px";
    iframe.style.border = "none";
    iframe.srcdoc = sandboxHtml(htmlContent);

    iframe.onload = async () => {
      try {
        const html2canvas = (await import("html2canvas")).default;
        const body = iframe.contentDocument?.body;
        if (!body) {
          document.body.removeChild(iframe);
          resolve(null);
          return;
        }
        const canvas = await html2canvas(body, {
          width: 1024,
          height: 768,
          windowWidth: 1024,
          windowHeight: 768,
          useCORS: true,
        });
        canvas.toBlob(
          (blob) => {
            document.body.removeChild(iframe);
            resolve(blob);
          },
          "image/png",
          0.8
        );
      } catch {
        document.body.removeChild(iframe);
        resolve(null);
      }
    };

    document.body.appendChild(iframe);
  });
}

interface SpaceFormProps {
  space?: Space;
  collectionId?: string;
}

export function SpaceForm({ space, collectionId }: SpaceFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isEditing = !!space;

  const detectInitialMode = (): SpaceMode => {
    if (space?.markdown_content) return "markdown";
    if (space?.video_url) return "video";
    if (space?.image_url) return "image";
    if (space?.pdf_url) return "pdf";
    if (space?.html_url) return "html";
    if (space?.url) return "url";
    return "ai";
  };

  const [spaceType, setSpaceType] = useState<SpaceMode>(detectInitialMode);
  const [title, setTitle] = useState(space?.title || "");
  const [description, setDescription] = useState(space?.description || "");
  const [url, setUrl] = useState(space?.url || "");
  const [htmlContent, setHtmlContent] = useState("");
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const [isPublic, setIsPublic] = useState(space?.is_public ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [htmlFileName, setHtmlFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDragOver, setPdfDragOver] = useState(false);
  const pdfFileInputRef = useRef<HTMLInputElement>(null);

  // Image type state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDragOver, setImageDragOver] = useState(false);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  // Video type state
  const [videoUrl, setVideoUrl] = useState(space?.video_url || "");

  // Markdown type state
  const [markdownContent, setMarkdownContent] = useState(space?.markdown_content || "");
  const [markdownTab, setMarkdownTab] = useState<"write" | "preview">("write");

  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>(space?.hashtags ?? []);

  const [generatedPreviewSrc, setGeneratedPreviewSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const previewFileInputRef = useRef<HTMLInputElement>(null);
  const generatedBlobUrlRef = useRef<string | null>(null);
  const screenshotDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [previewGradient, setPreviewGradient] = useState<GradientKey>(
    (space?.preview_gradient as GradientKey) || DEFAULT_GRADIENT
  );
  const [previewTitle, setPreviewTitle] = useState(space?.preview_title || "");
  const [clearExistingImage, setClearExistingImage] = useState(false);
  const [htmlAreaCollapsed, setHtmlAreaCollapsed] = useState(true);
  const [insufficientCredits, setInsufficientCredits] = useState(false);

  // Stable per-mount idempotency token — retried submits resolve to the same space row.
  const clientRequestIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    supabase
      .from("spaces")
      .select("hashtags")
      .eq("is_public", true)
      .limit(200)
      .then(({ data }) => {
        if (data) {
          const all = [...new Set(data.flatMap((s) => s.hashtags ?? []))].sort();
          setHashtagSuggestions(all);
        }
      });
  }, [supabase]);

  useEffect(() => {
    if (space?.html_url && !htmlContent) {
      fetch(space.html_url)
        .then((r) => r.text())
        .then(setHtmlContent)
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [space?.html_url]);

  // Track object URL for preview image thumbnail
  useEffect(() => {
    if (!previewImage) { setPreviewObjectUrl(null); return; }
    const url = URL.createObjectURL(previewImage);
    setPreviewObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewImage]);

  // Track object URL for content image
  useEffect(() => {
    if (!imageFile) { setImageObjectUrl(null); return; }
    const url = URL.createObjectURL(imageFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  // Cleanup generated blob URL on unmount
  useEffect(() => {
    return () => {
      if (generatedBlobUrlRef.current) URL.revokeObjectURL(generatedBlobUrlRef.current);
      if (screenshotDebounceRef.current) clearTimeout(screenshotDebounceRef.current);
    };
  }, []);

  // Auto-fetch preview when URL is entered (debounced, only when no image already set)
  useEffect(() => {
    if (spaceType !== "url") return;
    const trimmed = url.trim();
    const hasImage = !!previewImage || (!!space?.preview_image_url && !clearExistingImage);
    if (!trimmed || hasImage || showCropper) return;

    if (screenshotDebounceRef.current) clearTimeout(screenshotDebounceRef.current);
    screenshotDebounceRef.current = setTimeout(() => {
      handleGenerateFromUrl(trimmed);
    }, 900);

    return () => {
      if (screenshotDebounceRef.current) clearTimeout(screenshotDebounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, spaceType]);

  const cleanupGeneratedPreview = () => {
    if (generatedBlobUrlRef.current) {
      URL.revokeObjectURL(generatedBlobUrlRef.current);
      generatedBlobUrlRef.current = null;
    }
    setGeneratedPreviewSrc(null);
    setShowCropper(false);
  };

  const handleGeneratePreview = async () => {
    setIsGenerating(true);
    try {
      const blob = await captureHtmlScreenshot(htmlContent);
      if (blob) {
        if (generatedBlobUrlRef.current) URL.revokeObjectURL(generatedBlobUrlRef.current);
        const src = URL.createObjectURL(blob);
        generatedBlobUrlRef.current = src;
        setGeneratedPreviewSrc(src);
        setShowCropper(true);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCropConfirm = (blob: Blob) => {
    const file = new File([blob], "preview.jpg", { type: "image/jpeg" });
    setPreviewImage(file);
    cleanupGeneratedPreview();
    setScreenshotError(null);
  };

  const handleGenerateFromUrl = async (overrideUrl?: string) => {
    const target = (overrideUrl ?? url).trim();
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
      setScreenshotError("Couldn't fetch a preview for this URL. You can upload one manually.");
    } finally {
      setIsGenerating(false);
    }
  };

  const MAX_HTML_SIZE = 1.5 * 1024 * 1024;
  const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024;
  const MAX_CONTENT_IMAGE_SIZE = 5 * 1024 * 1024;
  const MAX_PDF_SIZE = 10 * 1024 * 1024;

  const LIMITS = {
    title: 100,
    description: 300,
    descriptionLines: 5,
    url: 500,
    videoUrl: 500,
    markdownContent: 100_000,
  };

  const extractStoragePath = (publicUrl: string, bucket: string): string | null => {
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length).split("?")[0];
  };

  const handlePdfFileUpload = (file: File) => {
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted");
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setError("PDF file must be under 10 MB");
      return;
    }
    setPdfFile(file);
  };

  const handleHtmlFileUpload = (file: File) => {
    if (file.size > MAX_HTML_SIZE) {
      setError("HTML file must be under 1.5 MB");
      return;
    }
    setHtmlFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setHtmlContent(content);
    };
    reader.readAsText(file);
  };

  const handleImageFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are accepted");
      return;
    }
    if (file.size > MAX_CONTENT_IMAGE_SIZE) {
      setError("Image file must be under 5 MB");
      return;
    }
    setImageFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInsufficientCredits(false);
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be logged in");
        return;
      }

      if (spaceType === "url" && !url) {
        setError("URL is required for URL content");
        setLoading(false);
        return;
      }

      let normalizedUrl = url.trim();
      if (
        spaceType === "url" &&
        normalizedUrl &&
        !/^https?:\/\//i.test(normalizedUrl)
      ) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      if (
        spaceType === "url" &&
        /^(javascript|data|vbscript):/i.test(normalizedUrl)
      ) {
        setError("Invalid URL scheme. Only http and https URLs are allowed.");
        setLoading(false);
        return;
      }

      if (spaceType === "html" && !htmlContent && !space?.html_url) {
        setError("HTML content is required. Upload a file or paste HTML.");
        setLoading(false);
        return;
      }

      // "ai" type: nothing to validate — we upload a placeholder stub

      if (spaceType === "pdf" && !pdfFile && !space?.pdf_url) {
        setError("A PDF file is required.");
        setLoading(false);
        return;
      }

      if (spaceType === "image" && !imageFile && !space?.image_url) {
        setError("An image file is required.");
        setLoading(false);
        return;
      }

      if (spaceType === "video") {
        if (!videoUrl.trim()) {
          setError("A video URL is required.");
          setLoading(false);
          return;
        }
        if (!detectVideo(videoUrl.trim())) {
          setError("Unsupported video URL. Please use a YouTube, Vimeo, or Loom link.");
          setLoading(false);
          return;
        }
      }

      if (spaceType === "markdown" && !markdownContent.trim() && !space?.markdown_content) {
        setError("Markdown content is required.");
        setLoading(false);
        return;
      }

      if (!title.trim()) {
        setError("Title is required.");
        setLoading(false);
        return;
      }
      if (title.length > LIMITS.title) {
        setError(`Title must be ${LIMITS.title} characters or less`);
        setLoading(false);
        return;
      }
      if (description.length > LIMITS.description) {
        setError(`Description must be ${LIMITS.description} characters or less`);
        setLoading(false);
        return;
      }
      if (markdownContent.length > LIMITS.markdownContent) {
        setError(`Markdown content must be ${LIMITS.markdownContent.toLocaleString()} characters or less`);
        setLoading(false);
        return;
      }

      let preview_image_url = (clearExistingImage && !previewImage) ? null : (space?.preview_image_url || null);
      let html_url = space?.html_url || null;
      let pdf_url = space?.pdf_url || null;
      let image_url = space?.image_url || null;

      if (previewImage && previewImage.size > MAX_IMAGE_SIZE) {
        setError("Preview image must be under 1.5 MB");
        setLoading(false);
        return;
      }

      // Delete old preview image when replacing or removing
      if (space?.preview_image_url && (previewImage || clearExistingImage)) {
        const oldPath = extractStoragePath(space.preview_image_url, "space-previews");
        if (oldPath) {
          await supabase.storage.from("space-previews").remove([oldPath]);
        }
      }

      // Upload preview image if provided
      if (previewImage) {
        const fileExt = previewImage.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("space-previews")
          .upload(filePath, previewImage);

        if (uploadError) {
          setError("Failed to upload image: " + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("space-previews")
          .getPublicUrl(filePath);
        preview_image_url = publicUrlData.publicUrl;
      }

      // AI Generated type: upload a minimal placeholder HTML
      if (spaceType === "ai" && !space?.html_url) {
        const stub = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  body { margin: 0; background: #09090b; color: #ffffff; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  p { opacity: 0.35; font-size: 14px; letter-spacing: 0.01em; }
</style>
</head>
<body><p>Use the AI assistant to generate content ✦</p></body>
</html>`;
        const stubBlob = new Blob([stub], { type: "text/html" });
        const filePath = `${user.id}/${Date.now()}.html`;
        const { error: uploadError } = await supabase.storage
          .from("space-html")
          .upload(filePath, stubBlob, { contentType: "text/html", upsert: false });
        if (uploadError) {
          setError("Failed to create content: " + uploadError.message);
          return;
        }
        const { data: publicUrlData } = supabase.storage.from("space-html").getPublicUrl(filePath);
        html_url = publicUrlData.publicUrl;
      }

      // Upload HTML content
      if (spaceType === "html" && htmlContent) {
        const htmlBlob = new Blob([htmlContent], { type: "text/html" });
        const filePath = `${user.id}/${Date.now()}.html`;
        const { error: uploadError } = await supabase.storage
          .from("space-html")
          .upload(filePath, htmlBlob, { contentType: "text/html", upsert: false });

        if (uploadError) {
          setError("Failed to upload HTML: " + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("space-html")
          .getPublicUrl(filePath);
        html_url = publicUrlData.publicUrl;
      }

      // Upload PDF
      if (spaceType === "pdf" && pdfFile) {
        const filePath = `${user.id}/${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("space-pdfs")
          .upload(filePath, pdfFile, { contentType: "application/pdf", upsert: false });

        if (uploadError) {
          setError("Failed to upload PDF: " + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("space-pdfs")
          .getPublicUrl(filePath);
        pdf_url = publicUrlData.publicUrl;
      }

      // Upload content image
      if (spaceType === "image" && imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const filePath = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("space-images")
          .upload(filePath, imageFile, { contentType: imageFile.type, upsert: false });

        if (uploadError) {
          setError("Failed to upload image: " + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("space-images")
          .getPublicUrl(filePath);
        image_url = publicUrlData.publicUrl;

        // Auto-use the uploaded image as the preview if none was manually set
        if (!previewImage && !space?.preview_image_url) {
          preview_image_url = image_url;
        }
      }

      // For video: auto-use YouTube or Vimeo thumbnail as preview if none set
      let finalVideoUrl: string | null = null;
      if (spaceType === "video") {
        finalVideoUrl = videoUrl.trim();
        if (!previewImage && !space?.preview_image_url && finalVideoUrl) {
          const ytThumb = getYoutubeThumbnail(finalVideoUrl);
          if (ytThumb) {
            preview_image_url = ytThumb;
          } else {
            const vimeoThumb = await getVimeoThumbnail(finalVideoUrl);
            if (vimeoThumb) preview_image_url = vimeoThumb;
          }
        }
      }

      const spaceData = {
        title,
        description: description || null,
        url: spaceType === "url" ? normalizedUrl : null,
        html_url: (spaceType === "html" || spaceType === "ai") ? html_url : null,
        pdf_url: spaceType === "pdf" ? pdf_url : null,
        image_url: spaceType === "image" ? image_url : null,
        video_url: spaceType === "video" ? finalVideoUrl : null,
        markdown_content: spaceType === "markdown" ? (markdownContent.trim() || null) : null,
        preview_image_url,
        preview_gradient: previewGradient,
        preview_title: previewTitle.trim() || null,
        is_public: isPublic,
        user_id: user.id,
        hashtags: selectedHashtags,
      };

      if (isEditing && space) {
        // Edits don't cost credits — stay on the direct client update.
        // user_id stays on the row from creation; no need to re-send it.
        const { user_id: _omit, ...updatePayload } = spaceData;
        void _omit;
        const { error } = await supabase
          .from("spaces")
          .update(updatePayload)
          .eq("id", space.id);
        if (error) throw error;
        router.push(collectionId ? `/dashboard/collections/${collectionId}` : "/dashboard");
        router.refresh();
      } else {
        // First-time publish goes through the server action so credits are deducted atomically.
        // On success the action calls redirect() — nothing is returned, and control
        // won't reach the code below because Next.js navigates before resolving.
        const { user_id: _omit, ...publishPayload } = spaceData;
        void _omit;
        const result = await publishSpace(
          publishPayload,
          clientRequestIdRef.current,
          collectionId
        );
        // Only error results come back; success redirects server-side.
        if (result && !result.ok) {
          if (result.error === "INSUFFICIENT_CREDITS") {
            setInsufficientCredits(true);
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
      const supaErr = err as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };
      const message =
        supaErr?.message ||
        (err instanceof Error ? err.message : "Something went wrong");
      const details = supaErr?.details || supaErr?.hint || "";
      setError(details ? `${message} — ${details}` : message);
    } finally {
      setLoading(false);
    }
  };

  const typeButtons: { type: SpaceMode; icon: React.ElementType; label: string; description: string; beta?: boolean }[] = [
    { type: "ai", icon: Sparkles, label: "AI Generated", description: "Generate with AI", beta: true },
    { type: "html", icon: Code, label: "HTML", description: "Paste or upload HTML" },
    { type: "image", icon: ImageIcon, label: "Image", description: "Upload a photo or graphic" },
    { type: "video", icon: Video, label: "Video", description: "YouTube, Vimeo, or Loom" },
    { type: "markdown", icon: AlignLeft, label: "Note", description: "Write with Markdown" },
    { type: "pdf", icon: FileText, label: "PDF", description: "Upload a PDF document" },
    { type: "url", icon: Globe, label: "Website", description: "Link to an external site" },
  ];

  const isSubmitDisabled =
    loading ||
    !title.trim() ||
    (spaceType === "url" && !url.trim()) ||
    (spaceType === "html" && !htmlContent && !space?.html_url) ||
    (spaceType === "pdf" && !pdfFile && !space?.pdf_url) ||
    (spaceType === "image" && !imageFile && !space?.image_url) ||
    (spaceType === "video" && !videoUrl.trim()) ||
    (spaceType === "markdown" && !markdownContent.trim() && !space?.markdown_content);
  // "ai" type only requires a title — no additional validation

  return (
    <Card className="w-full max-w-2xl shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Rocket className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-xl">
              {isEditing ? "Edit Content" : "Create New Content"}
            </CardTitle>
            <CardDescription>
              Share a website, image, video, note, HTML, or PDF.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Space Type Toggle */}
          <div className="space-y-2">
            <Label>Content Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {typeButtons.map(({ type, icon: Icon, label, description, beta }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSpaceType(type)}
                  className={`relative rounded-xl border-2 px-3 py-3 text-left transition-all ${
                    spaceType === type
                      ? "border-violet-600 bg-violet-50 dark:bg-violet-950/50 shadow-sm shadow-violet-600/10"
                      : "border-border/60 hover:border-violet-500/30 hover:bg-muted/50"
                  }`}
                >
                  {beta && (
                    <span className="absolute top-1.5 right-1.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-violet-100 dark:bg-violet-900/60 text-violet-600 dark:text-violet-400 leading-none">
                      Beta
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        spaceType === type
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`font-semibold text-sm ${
                        spaceType === type
                          ? "text-violet-700 dark:text-violet-300"
                          : ""
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-snug">
                    {description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Generated info */}
          {spaceType === "ai" && (
            <div className="flex gap-3 rounded-xl border border-violet-300/60 dark:border-violet-700/50 bg-violet-50/50 dark:bg-violet-950/20 px-4 py-4">
              <Sparkles className="h-5 w-5 shrink-0 text-violet-500 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-violet-700 dark:text-violet-300">
                  Generate content after creating
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Give your content a title, then create it. Once inside, use the <span className="font-medium text-foreground">AI Edit</span> button to describe what you want and AI will build it for you.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title" className="flex items-center gap-1.5">
                Title
                <span className="rounded-full bg-violet-100 dark:bg-violet-950/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  Required
                </span>
              </Label>
              <span className="text-xs text-muted-foreground">{title.length}/{LIMITS.title}</span>
            </div>
            <Input
              id="title"
              placeholder="My Awesome App"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, LIMITS.title))}
              maxLength={LIMITS.title}
              required
              aria-required="true"
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label>Hashtags</Label>
            <p className="text-xs text-muted-foreground">Add up to 3 hashtags — search existing or create new ones</p>
            <HashtagPicker
              suggestions={hashtagSuggestions}
              selectedHashtags={selectedHashtags}
              onChange={setSelectedHashtags}
            />
          </div>

          {/* PDF input */}
          {spaceType === "pdf" && (
            <div className="space-y-4">
              <input
                ref={pdfFileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePdfFileUpload(file);
                }}
              />

              {pdfFile ? (
                <div className="flex items-center gap-3 rounded-xl border border-violet-400/50 bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-violet-500" />
                  <span className="flex-1 text-sm font-medium text-violet-700 dark:text-violet-300 truncate">
                    {pdfFile.name}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {(pdfFile.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPdfFile(null);
                      if (pdfFileInputRef.current) pdfFileInputRef.current.value = "";
                    }}
                    className="rounded-full p-1 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors"
                  >
                    <X className="h-4 w-4 text-violet-500" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => pdfFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setPdfDragOver(true); }}
                  onDragLeave={() => setPdfDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setPdfDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handlePdfFileUpload(file);
                  }}
                  className={`w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    pdfDragOver
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                      : "border-border/60 hover:border-violet-400/60 hover:bg-muted/40"
                  }`}
                >
                  <UploadCloud className={`mx-auto h-8 w-8 mb-3 ${pdfDragOver ? "text-violet-500" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium text-foreground">Drop your PDF here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or <span className="text-violet-600 dark:text-violet-400 underline underline-offset-2">browse</span> — .pdf, up to 10 MB
                  </p>
                </button>
              )}

              {isEditing && space?.pdf_url && !pdfFile && (
                <p className="text-xs text-muted-foreground">
                  Current PDF will be kept if no new file is provided.
                </p>
              )}
            </div>
          )}

          {/* URL input */}
          {spaceType === "url" && (
            <div className="space-y-2">
              <Label htmlFor="url">Website URL *</Label>
              <Input
                id="url"
                type="text"
                placeholder="example.com"
                value={url}
                onChange={(e) => { setUrl(e.target.value.slice(0, LIMITS.url)); setScreenshotError(null); }}
                maxLength={LIMITS.url}
                required
                className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
              />
              <p className="text-xs text-muted-foreground">
                No need to type https:// — we&apos;ll add it automatically
              </p>
            </div>
          )}

          {/* HTML input */}
          {spaceType === "html" && (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleHtmlFileUpload(file);
                }}
              />

              {htmlFileName ? (
                <div className="flex items-center gap-3 rounded-xl border border-violet-400/50 bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
                  <FileCode2 className="h-5 w-5 shrink-0 text-violet-500" />
                  <span className="flex-1 text-sm font-medium text-violet-700 dark:text-violet-300 truncate">
                    {htmlFileName}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setHtmlFileName("");
                      setHtmlContent("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="rounded-full p-1 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors"
                  >
                    <X className="h-4 w-4 text-violet-500" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleHtmlFileUpload(file);
                  }}
                  className={`w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    dragOver
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                      : "border-border/60 hover:border-violet-400/60 hover:bg-muted/40"
                  }`}
                >
                  <UploadCloud className={`mx-auto h-8 w-8 mb-3 ${dragOver ? "text-violet-500" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium text-foreground">Drop your HTML file here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or <span className="text-violet-600 dark:text-violet-400 underline underline-offset-2">browse</span> — .html / .htm, up to 1.5 MB
                  </p>
                </button>
              )}

              <div className="relative flex items-center">
                <div className="flex-1 border-t border-border/50" />
                <button
                  type="button"
                  onClick={() => setHtmlAreaCollapsed((v) => !v)}
                  className="flex items-center gap-1.5 px-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {htmlAreaCollapsed ? (
                    <><ChevronDown className="h-3 w-3" />show HTML editor</>
                  ) : (
                    <><ChevronUp className="h-3 w-3" />or paste HTML directly</>
                  )}
                </button>
                <div className="flex-1 border-t border-border/50" />
              </div>

              {!htmlAreaCollapsed && (
                <div className="space-y-2">
                  <Textarea
                    id="htmlContent"
                    placeholder={"<!DOCTYPE html>\n<html>\n  <head>...</head>\n  <body>...</body>\n</html>"}
                    value={htmlContent}
                    onChange={(e) => { setHtmlContent(e.target.value); setHtmlFileName(""); }}
                    rows={6}
                    className="font-mono text-xs bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
                  />
                  {htmlContent && (
                    <p className="text-xs text-muted-foreground">
                      {htmlContent.length.toLocaleString()} characters loaded
                    </p>
                  )}
                </div>
              )}

              {htmlContent && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="rounded-xl border border-border/60 overflow-hidden bg-white shadow-sm">
                    <iframe
                      srcDoc={sandboxHtml(htmlContent)}
                      className="w-full h-64 border-0"
                      sandbox="allow-scripts"
                      title="HTML Preview"
                    />
                  </div>
                </div>
              )}

              {isEditing && space?.html_url && !htmlContent && (
                <p className="text-xs text-muted-foreground">
                  Current HTML file will be kept if no new content is provided.
                </p>
              )}
            </div>
          )}

          {/* Image input */}
          {spaceType === "image" && (
            <div className="space-y-4">
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageFileUpload(file);
                }}
              />

              {imageFile && imageObjectUrl ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-violet-400/50 bg-black aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageObjectUrl}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-violet-400/50 bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
                    <ImageIcon className="h-5 w-5 shrink-0 text-violet-500" />
                    <span className="flex-1 text-sm font-medium text-violet-700 dark:text-violet-300 truncate">
                      {imageFile.name}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(imageFile.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        if (imageFileInputRef.current) imageFileInputRef.current.value = "";
                      }}
                      className="rounded-full p-1 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors"
                    >
                      <X className="h-4 w-4 text-violet-500" />
                    </button>
                  </div>
                </div>
              ) : isEditing && space?.image_url ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-border/60 bg-black aspect-video">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={space.image_url} alt="Current image" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Current image</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => imageFileInputRef.current?.click()}
                      className="gap-1.5 text-xs"
                    >
                      <UploadCloud className="h-3.5 w-3.5" />
                      Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageFileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
                  onDragLeave={() => setImageDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setImageDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleImageFileUpload(file);
                  }}
                  className={`w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    imageDragOver
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                      : "border-border/60 hover:border-violet-400/60 hover:bg-muted/40"
                  }`}
                >
                  <ImageIcon className={`mx-auto h-8 w-8 mb-3 ${imageDragOver ? "text-violet-500" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium text-foreground">Drop your image here</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or <span className="text-violet-600 dark:text-violet-400 underline underline-offset-2">browse</span> — JPG, PNG, GIF, WebP, up to 5 MB
                  </p>
                </button>
              )}
            </div>
          )}

          {/* Video input */}
          {spaceType === "video" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="videoUrl">Video URL *</Label>
                <Input
                  id="videoUrl"
                  type="text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value.slice(0, LIMITS.videoUrl))}
                  maxLength={LIMITS.videoUrl}
                  className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
                />
                <p className="text-xs text-muted-foreground">
                  Supports YouTube, Vimeo, and Loom links
                </p>
              </div>

              {/* Video preview */}
              {videoUrl.trim() && (() => {
                const info = detectVideo(videoUrl.trim());
                if (!info) {
                  return (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      URL not recognized. Please use a YouTube, Vimeo, or Loom link.
                    </p>
                  );
                }
                return (
                  <div className="rounded-xl overflow-hidden border border-border/60 bg-black aspect-video">
                    <iframe
                      src={info.embedUrl}
                      title="Video preview"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>
                );
              })()}
            </div>
          )}

          {/* Markdown input */}
          {spaceType === "markdown" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Content *</Label>
                <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setMarkdownTab("write")}
                    className={`px-3 py-1.5 transition-colors ${
                      markdownTab === "write"
                        ? "bg-violet-600 text-white"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarkdownTab("preview")}
                    className={`px-3 py-1.5 transition-colors ${
                      markdownTab === "preview"
                        ? "bg-violet-600 text-white"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Preview
                  </button>
                </div>
              </div>

              {markdownTab === "write" ? (
                <div className="space-y-1.5">
                  <Textarea
                    placeholder={"# My Note\n\nWrite your markdown here...\n\n- Bullet points\n- **Bold** and *italic*\n- `inline code`"}
                    value={markdownContent}
                    onChange={(e) => {
                      if (e.target.value.length <= LIMITS.markdownContent) setMarkdownContent(e.target.value);
                    }}
                    rows={12}
                    className="font-mono text-sm bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors resize-y"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Supports GitHub Flavored Markdown — headings, bold, lists, code blocks, tables
                    </p>
                    <span className={`text-xs ${markdownContent.length >= LIMITS.markdownContent ? "text-destructive" : "text-muted-foreground"}`}>
                      {markdownContent.length.toLocaleString()}/{LIMITS.markdownContent.toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="min-h-48 rounded-xl border border-border/60 bg-background px-5 py-4 overflow-auto">
                  {markdownContent.trim() ? (
                    <div className="prose-sm [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-6 [&_h1:first-child]:mt-0 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_p]:mb-3 [&_p]:leading-6 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_blockquote]:my-3 [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_a]:text-violet-600 dark:[&_a]:text-violet-400 [&_a]:underline [&_hr]:border-border [&_hr]:my-4 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1.5 [&_th]:bg-muted [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-sm">
                      <Markdown remarkPlugins={[remarkGfm]}>{markdownContent}</Markdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">Description</Label>
              <span className={`text-xs ${description.length >= LIMITS.description ? "text-destructive" : "text-muted-foreground"}`}>
                {description.length}/{LIMITS.description}
              </span>
            </div>
            <Textarea
              id="description"
              placeholder="A short description..."
              value={description}
              onChange={(e) => {
                const val = e.target.value;
                if (val.split("\n").length > LIMITS.descriptionLines) return;
                if (val.length > LIMITS.description) return;
                setDescription(val);
              }}
              rows={3}
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
          </div>

          {/* Preview Image / Gradient — hidden for image type (auto-set from content) */}
          {spaceType !== "image" && (
            <div className="space-y-3">
              <Label>Preview</Label>

              {showCropper && generatedPreviewSrc ? (
                <PreviewCropper
                  imageSrc={generatedPreviewSrc}
                  onConfirm={handleCropConfirm}
                  onCancel={cleanupGeneratedPreview}
                />
              ) : (() => {
                const hasNewImage = !!previewImage && !!previewObjectUrl;
                const hasExistingImage = !!space?.preview_image_url && !clearExistingImage;
                const hasImage = hasNewImage || hasExistingImage;
                const gradient = PREVIEW_GRADIENTS[previewGradient];

                return (
                  <>
                    {hasNewImage ? (
                      <div className="flex items-center gap-3 rounded-xl border border-violet-400/50 bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
                        <div className="relative w-16 h-10 rounded overflow-hidden shrink-0 border border-violet-300/50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewObjectUrl!} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-violet-700 dark:text-violet-300 truncate">{previewImage!.name}</p>
                          <p className="text-xs text-muted-foreground">{(previewImage!.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setPreviewImage(null); setClearExistingImage(true); }}
                          className="rounded-full p-1 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors shrink-0"
                          title="Remove image"
                        >
                          <X className="h-4 w-4 text-violet-500" />
                        </button>
                      </div>
                    ) : hasExistingImage ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
                        <div className="relative w-16 h-10 rounded overflow-hidden shrink-0 border border-border/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={space!.preview_image_url!} alt="Current preview" className="w-full h-full object-cover" />
                        </div>
                        <span className="flex-1 text-xs text-muted-foreground">Current preview image</span>
                        <button
                          type="button"
                          onClick={() => setClearExistingImage(true)}
                          className="rounded-full p-1 hover:bg-muted transition-colors shrink-0"
                          title="Remove image"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      {spaceType === "html" && (htmlContent || space?.html_url) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleGeneratePreview}
                          disabled={isGenerating}
                          className="gap-1.5 border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                        >
                          {isGenerating ? (
                            <>
                              <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                              Generating…
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3.5 w-3.5" />
                              Generate from content
                            </>
                          )}
                        </Button>
                      )}
                      {spaceType === "url" && url.trim() && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateFromUrl()}
                          disabled={isGenerating}
                          className="gap-1.5 border-violet-400/50 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                        >
                          {isGenerating ? (
                            <>
                              <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                              Capturing…
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3.5 w-3.5" />
                              Capture from URL
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => previewFileInputRef.current?.click()}
                        className="gap-1.5 border-border/60"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        {hasImage ? "Replace image" : "Upload image"}
                      </Button>
                      <input
                        ref={previewFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) { setPreviewImage(f); setClearExistingImage(false); }
                        }}
                      />
                    </div>
                    {screenshotError && (
                      <p className="text-xs text-muted-foreground">{screenshotError}</p>
                    )}

                    {!hasImage && (
                      <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                        <p className="text-xs font-medium text-foreground/70">Background color</p>

                        <div className="flex gap-2 flex-wrap">
                          {GRADIENT_KEYS.map((key) => {
                            const g = PREVIEW_GRADIENTS[key];
                            const selected = previewGradient === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                title={g.label}
                                onClick={() => setPreviewGradient(key)}
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
                            Preview title <span className="font-normal text-muted-foreground">(optional)</span>
                          </p>
                          <input
                            type="text"
                            placeholder="e.g. My Portfolio"
                            value={previewTitle}
                            maxLength={64}
                            onChange={(e) => setPreviewTitle(e.target.value)}
                            className="w-full rounded-lg border border-border/60 bg-muted/50 px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 focus:bg-background transition-colors placeholder:text-muted-foreground/50"
                          />
                        </div>

                        <div className="overflow-hidden rounded-lg aspect-video border border-border/40">
                          <div className={`flex h-full w-full items-center justify-center ${gradient.bg}`}>
                            {previewTitle.trim() ? (
                              <span className={`text-center text-2xl font-bold leading-tight px-3 line-clamp-3 ${gradient.text}`}>
                                {previewTitle}
                              </span>
                            ) : (
                              <span className={`text-2xl font-bold ${gradient.text}`}>
                                {title[0]?.toUpperCase() || "?"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {hasImage && (
                      <p className="text-xs text-muted-foreground">Shown as the content thumbnail</p>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/50">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-violet-600"
              />
              <Label htmlFor="isPublic" className="font-normal cursor-pointer">
                Make this Space public
              </Label>
            </div>
            {isPublic && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                <Globe className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Everyone will be able to view this Space, but only you can edit it.
                </p>
              </div>
            )}
          </div>

          {insufficientCredits && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                You&apos;re out of credits.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Publishing a space costs credits. Top up to keep sharing.
              </p>
              <Link
                href="/dashboard/credits"
                className="inline-flex items-center mt-2 text-sm font-semibold text-amber-900 dark:text-amber-200 underline underline-offset-2"
              >
                Buy credits →
              </Link>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitDisabled}>
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Content"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="border-border/60 hover:border-violet-500/50 transition-colors"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
