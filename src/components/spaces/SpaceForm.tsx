"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { Code, Globe, Rocket, UploadCloud, FileCode2, FileText, X, Download, Wand2, ImageIcon, Check, ChevronDown, ChevronUp } from "lucide-react";
import { PREVIEW_GRADIENTS, GRADIENT_KEYS, DEFAULT_GRADIENT, type GradientKey } from "@/lib/preview-gradients";
import { HashtagPicker } from "./HashtagPicker";
import { PreviewCropper } from "./PreviewCropper";
import type { Space } from "@/lib/types";
import { sandboxHtml } from "@/lib/sandbox-html";

type SpaceMode = "html" | "url" | "pdf";

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

  const [spaceType, setSpaceType] = useState<SpaceMode>(
    space?.pdf_url ? "pdf" : space?.html_url ? "html" : space?.url ? "url" : "html"
  );
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

  const MAX_HTML_SIZE = 1.5 * 1024 * 1024; // 1.5 MB

  const extractStoragePath = (publicUrl: string, bucket: string): string | null => {
    const marker = `/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length).split("?")[0];
  };
  const MAX_IMAGE_SIZE = 1.5 * 1024 * 1024; // 1.5 MB
  const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
        setError("URL is required for URL spaces");
        setLoading(false);
        return;
      }

      // Auto-prepend https:// if no protocol is provided
      let normalizedUrl = url.trim();
      if (
        spaceType === "url" &&
        normalizedUrl &&
        !/^https?:\/\//i.test(normalizedUrl)
      ) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      // Block javascript: and data: URL schemes
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

      if (spaceType === "pdf" && !pdfFile && !space?.pdf_url) {
        setError("A PDF file is required.");
        setLoading(false);
        return;
      }

      let preview_image_url = (clearExistingImage && !previewImage) ? null : (space?.preview_image_url || null);
      let html_url = space?.html_url || null;
      let pdf_url = space?.pdf_url || null;

      // Validate preview image size
      if (previewImage && previewImage.size > MAX_IMAGE_SIZE) {
        setError("Preview image must be under 1.5 MB");
        setLoading(false);
        return;
      }

      // Delete old preview image from bucket when replacing or removing it
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

      // Upload HTML content to storage bucket
      if (spaceType === "html" && htmlContent) {
        const htmlBlob = new Blob([htmlContent], { type: "text/html" });
        const filePath = `${user.id}/${Date.now()}.html`;
        const { error: uploadError } = await supabase.storage
          .from("space-html")
          .upload(filePath, htmlBlob, {
            contentType: "text/html",
            upsert: false,
          });

        if (uploadError) {
          setError("Failed to upload HTML: " + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("space-html")
          .getPublicUrl(filePath);
        html_url = publicUrlData.publicUrl;

      }

      // Upload PDF to storage bucket
      if (spaceType === "pdf" && pdfFile) {
        const filePath = `${user.id}/${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from("space-pdfs")
          .upload(filePath, pdfFile, {
            contentType: "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          setError("Failed to upload PDF: " + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("space-pdfs")
          .getPublicUrl(filePath);
        pdf_url = publicUrlData.publicUrl;
      }

      const spaceData = {
        title,
        description: description || null,
        url: spaceType === "url" ? normalizedUrl : null,
        html_url: spaceType === "html" ? html_url : null,
        pdf_url: spaceType === "pdf" ? pdf_url : null,
        preview_image_url,
        preview_gradient: previewGradient,
        preview_title: previewTitle.trim() || null,
        is_public: isPublic,
        user_id: user.id,
        hashtags: selectedHashtags,
      };

      let spaceId: string;

      if (isEditing && space) {
        const { error } = await supabase
          .from("spaces")
          .update(spaceData)
          .eq("id", space.id);
        if (error) throw error;
        spaceId = space.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("spaces")
          .insert(spaceData)
          .select("id")
          .single();
        if (error) throw error;
        spaceId = inserted.id;
      }

      // Link to collection if creating from a collection page
      if (!isEditing && collectionId) {
        await supabase
          .from("collection_spaces")
          .insert({ collection_id: collectionId, space_id: spaceId });
      }

      router.push(collectionId ? `/dashboard/collections/${collectionId}` : "/dashboard");
      router.refresh();
    } catch (err: unknown) {
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

  return (
    <Card className="w-full max-w-2xl shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Rocket className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-xl">
              {isEditing ? "Edit Space" : "Create a New Space"}
            </CardTitle>
            <CardDescription>
              Save a website URL or upload HTML generated by AI tools like
              Claude or ChatGPT.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Space Type Toggle */}
          <div className="space-y-2">
            <Label>Space Type</Label>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              {(
                [
                  { type: "html" as SpaceMode, icon: Code, label: "HTML Upload", description: "Paste or upload HTML from AI tools" },
                  { type: "pdf" as SpaceMode, icon: FileText, label: "PDF Upload", description: "Upload a PDF document" },
                  { type: "url" as SpaceMode, icon: Globe, label: "Website URL", description: "Link to an external website" },
                ] as const
              ).map(({ type, icon: Icon, label, description }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSpaceType(type)}
                  className={`shrink-0 min-w-[130px] flex-1 rounded-xl border-2 px-3 py-3 text-left transition-all ${
                    spaceType === type
                      ? "border-violet-600 bg-violet-50 dark:bg-violet-950/50 shadow-sm shadow-violet-600/10"
                      : "border-border/60 hover:border-violet-500/30 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        spaceType === type
                          ? "text-violet-600 dark:text-violet-400"
                          : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`font-semibold text-sm whitespace-nowrap ${
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

          <div className="space-y-2">
            <Label>Hashtags</Label>
            <p className="text-xs text-muted-foreground">Add up to 3 hashtags — search existing or create new ones</p>
            <HashtagPicker
              suggestions={hashtagSuggestions}
              selectedHashtags={selectedHashtags}
              onChange={setSelectedHashtags}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="My Awesome App"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
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
                  <p className="text-sm font-medium text-foreground">
                    Drop your PDF here
                  </p>
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
                onChange={(e) => { setUrl(e.target.value); setScreenshotError(null); }}
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
              {/* Drop zone */}
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
                  <p className="text-sm font-medium text-foreground">
                    Drop your HTML file here
                  </p>
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

              {/* Live Preview */}
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

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A short description of what this app does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
            />
          </div>

          {/* Preview Image / Gradient */}
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
                  {/* Active image */}
                  {hasNewImage ? (
                    <div className="flex items-center gap-3 rounded-xl border border-violet-400/50 bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
                      <div className="relative w-16 h-10 rounded overflow-hidden shrink-0 border border-violet-300/50">
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

                  {/* Upload / generate buttons */}
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

                  {/* Gradient section — shown when no image */}
                  {!hasImage && (
                    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-xs font-medium text-foreground/70">Background color</p>

                      {/* Swatch picker */}
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

                      {/* Optional title */}
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

                      {/* Mini preview */}
                      <div className="overflow-hidden rounded-lg aspect-video border border-border/40">
                        <div
                          className={`flex h-full w-full items-center justify-center ${gradient.bg}`}
                        >
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
                    <p className="text-xs text-muted-foreground">
                      Shown as the space thumbnail
                    </p>
                  )}
                </>
              );
            })()}
          </div>

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

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={
                loading ||
                !title.trim() ||
                (spaceType === "url" && !url.trim()) ||
                (spaceType === "html" && !htmlContent && !space?.html_url) ||
                (spaceType === "pdf" && !pdfFile && !space?.pdf_url)
              }
            >
              {loading
                ? "Saving..."
                : isEditing
                ? "Save Changes"
                : "Create Space"}
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
