"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Pencil, X, Save, Loader2 } from "lucide-react";
import { sandboxHtml } from "@/lib/sandbox-html";

// Extract the Supabase Storage path from the public URL.
// URL format: https://<ref>.supabase.co/storage/v1/object/public/space-html/<path>
function extractStoragePath(publicUrl: string): string {
  const marker = "/space-html/";
  const clean = publicUrl.split("?")[0];
  const idx = clean.indexOf(marker);
  if (idx === -1) throw new Error("Unexpected html_url format");
  return clean.slice(idx + marker.length);
}

/** Render HTML in a hidden iframe and capture a screenshot using html2canvas */
async function captureHtmlScreenshot(htmlContent: string): Promise<Blob | null> {
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
        if (!body) { document.body.removeChild(iframe); resolve(null); return; }
        const canvas = await html2canvas(body, {
          width: 1024, height: 768, windowWidth: 1024, windowHeight: 768, useCORS: true,
        });
        canvas.toBlob((blob) => { document.body.removeChild(iframe); resolve(blob); }, "image/png", 0.8);
      } catch {
        document.body.removeChild(iframe);
        resolve(null);
      }
    };

    document.body.appendChild(iframe);
  });
}

interface HtmlSpaceEditorProps {
  spaceId: string;
  htmlUrl: string;
  spaceTitle: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GrapesjsEditor = any;

export function HtmlSpaceEditor({ spaceId, htmlUrl, spaceTitle }: HtmlSpaceEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  // Incremented after each save to force the sandbox iframe to reload
  const [iframeVersion, setIframeVersion] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const grapesjsRef = useRef<GrapesjsEditor>(null);
  const htmlAtEditStartRef = useRef("");

  // Inject GrapeJS CSS once on mount
  useEffect(() => {
    const cssId = "grapesjs-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "/grapesjs/grapes.min.css";
      document.head.appendChild(link);
    }
  }, []);

  // Init / destroy GrapeJS when isEditing toggles
  useEffect(() => {
    if (!isEditing) return;
    if (!editorContainerRef.current) return;

    let editor: GrapesjsEditor | null = null;
    let cancelled = false;

    const init = async () => {
      const grapesjs = (await import("grapesjs")).default;
      const gjsPreset = (await import("grapesjs-preset-webpage")).default;

      if (cancelled || !editorContainerRef.current) return;

      editor = grapesjs.init({
        container: editorContainerRef.current,
        height: "100%",
        width: "auto",
        fromElement: false,
        components: htmlAtEditStartRef.current,
        storageManager: false,
        plugins: [gjsPreset],
        assetManager: {
          // Custom upload handler — sends files to our asset API (2 MB limit enforced server-side)
          uploadFile: async (e: Event) => {
            const files =
              (e as DragEvent).dataTransfer?.files ??
              (e.target as HTMLInputElement)?.files;
            if (!files?.length) return;

            for (const file of Array.from(files)) {
              const fd = new FormData();
              fd.append("file", file);
              try {
                const res = await fetch(`/api/spaces/${spaceId}/assets`, {
                  method: "POST",
                  body: fd,
                });
                if (!res.ok) {
                  const { error: msg } = await res.json();
                  console.error("Asset upload failed:", msg);
                  continue;
                }
                const { src, name } = await res.json() as { src: string; name: string };
                editor?.AssetManager.add([{ src, name, type: "image" }]);
              } catch {
                console.error("Asset upload error");
              }
            }
          },
          assets: [],
        },
      });

      grapesjsRef.current = editor;

      // Pre-load existing assets for this space
      fetch(`/api/spaces/${spaceId}/assets`)
        .then((r) => r.json())
        .then(({ assets }: { assets: Array<{ src: string; name: string }> }) => {
          if (assets?.length) {
            editor?.AssetManager.add(
              assets.map((a) => ({ src: a.src, name: a.name, type: "image" }))
            );
          }
        })
        .catch(() => {});
    };

    init();

    return () => {
      cancelled = true;
      if (grapesjsRef.current) {
        grapesjsRef.current.destroy();
        grapesjsRef.current = null;
      }
    };
  }, [isEditing, spaceId]);

  const handleEdit = useCallback(async () => {
    setError(null);
    setIsLoadingEdit(true);
    try {
      // Fetch the latest HTML via our sandbox route (auth-aware, cache-busted)
      const res = await fetch(`/sandbox/${spaceId}?v=${Date.now()}`, { cache: "no-store" });
      htmlAtEditStartRef.current = await res.text();
      setIsEditing(true);
    } catch {
      setError("Failed to load content for editing.");
    } finally {
      setIsLoadingEdit(false);
    }
  }, [spaceId]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    const editor = grapesjsRef.current;
    if (!editor) return;

    setIsSaving(true);
    setError(null);

    try {
      const bodyHtml = editor.getHtml() as string;
      const css = editor.getCss() as string;
      const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>${bodyHtml}</body>
</html>`;

      const supabase = createClient();
      const storagePath = extractStoragePath(htmlUrl);
      const htmlBlob = new Blob([fullHtml], { type: "text/html" });

      const { error: uploadError } = await supabase.storage
        .from("space-html")
        .upload(storagePath, htmlBlob, { contentType: "text/html", upsert: true });

      if (uploadError) throw uploadError;

      // Regenerate preview screenshot in the background (non-blocking)
      captureHtmlScreenshot(fullHtml).then(async (screenshotBlob) => {
        if (!screenshotBlob) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const previewPath = `${user.id}/${spaceId}-preview.png`;
        const { error: ssError } = await supabase.storage
          .from("space-previews")
          .upload(previewPath, screenshotBlob, { contentType: "image/png", upsert: true });
        if (ssError) return;
        const { data: { publicUrl } } = supabase.storage
          .from("space-previews")
          .getPublicUrl(previewPath);
        await supabase.from("spaces").update({ preview_image_url: publicUrl }).eq("id", spaceId);
      });

      // Bump version so the sandbox iframe reloads with the new content
      setIframeLoaded(false);
      setIframeVersion((v) => v + 1);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [htmlUrl, spaceId]);

  if (isEditing) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b px-4 py-2 bg-background/95 backdrop-blur-xl z-10">
          <span className="text-sm font-medium text-muted-foreground truncate max-w-xs">
            Editing: <span className="text-foreground">{spaceTitle}</span>
          </span>
          <div className="flex items-center gap-2">
            {error && (
              <p className="text-sm text-destructive max-w-xs truncate">{error}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
              className="gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-1.5"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
        <div ref={editorContainerRef} className="flex-1 min-h-0" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {!iframeLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <iframe
        src={`/sandbox/${spaceId}?v=${iframeVersion}`}
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-forms allow-downloads allow-popups"
        title={spaceTitle}
        style={{ opacity: iframeLoaded ? 1 : 0 }}
        onLoad={() => setIframeLoaded(true)}
      />
      <div className="absolute bottom-4 right-4 hidden lg:flex">
        <Button
          size="sm"
          onClick={handleEdit}
          disabled={isLoadingEdit}
          className="gap-1.5"
        >
          {isLoadingEdit ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Pencil className="h-3.5 w-3.5" />
          )}
          Edit Page
        </Button>
      </div>
    </div>
  );
}
