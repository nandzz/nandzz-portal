"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Globe,
  ImagePlus,
  Images,
  Loader2,
  MessageSquareText,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_GRADIENT } from "@/lib/preview-gradients";
import { getContentTypeDescription, getContentTypeLabel } from "@/lib/spaces/content-types";
import { useLanguage } from "@/contexts/LanguageContext";
import { HashtagPicker } from "../HashtagPicker";
import { SHARED_LIMITS } from "../../hooks/useContentBuilderForm";
import { loadHashtagSuggestions } from "../../actions/load-hashtag-suggestions";
import { revalidateContents } from "../../actions/revalidate-contents";
import { publishSpaceItem, type PublishSpacePayload } from "../../actions/publish-space";
import { getCurrentUserId, uploadSpaceImage } from "../../storage";
import { compressImage, isUploadableImage, MAX_RAW_IMAGE_BYTES } from "../../compress-image";

const MAX_BATCH = 20;
const UPLOAD_CONCURRENCY = 3;

type ItemStatus = "idle" | "working" | "done" | "error";

interface BatchItem {
  id: string;
  file: File;
  objectUrl: string;
  title: string;
  caption: string;
  status: ItemStatus;
  /** Why this item failed, shown in the caption panel. */
  errorMessage?: string;
  /** Set once the file is in storage, so a retry never re-uploads it. */
  imageUrl?: string;
  /** Stable per item — a retried publish resolves to the same space row. */
  requestId: string;
}

class UnsupportedImageError extends Error {}

/** Tiny promise pool: runs at most `max` tasks at once. */
function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= max) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };
  return <T,>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
}

/**
 * Create-mode image builder: pick or drop many photos at once, give each an
 * optional title + caption, share hashtags + visibility across the batch, then
 * publish them as one space per photo. The title is optional (stored as "" when
 * blank); the caption is the description. Editing a single image still goes
 * through `ImageBuilder` + the shared shell.
 */
export function ImageBatchBuilder({ collectionId }: { collectionId?: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const cb = t.contentBuilder;

  const [items, setItems] = useState<BatchItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [spaceLimitReached, setSpaceLimitReached] = useState(false);
  const [captionApplied, setCaptionApplied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    loadHashtagSuggestions().then(setHashtagSuggestions);
  }, []);

  // Revoke every preview URL on unmount.
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.objectUrl)), []);

  const addFiles = (files: File[]) => {
    if (publishing || files.length === 0) return;
    setError("");
    setNotice("");
    const valid = files.filter((f) => f.type.startsWith("image/") && f.size <= MAX_RAW_IMAGE_BYTES);
    const skipped = files.length - valid.length;
    const room = MAX_BATCH - itemsRef.current.length;
    const accepted = valid.slice(0, Math.max(0, room));

    const messages: string[] = [];
    if (skipped > 0) messages.push(cb.imageBatchSkipped.replace("{count}", String(skipped)));
    if (valid.length > accepted.length) messages.push(cb.imageBatchMaxReached.replace("{max}", String(MAX_BATCH)));
    if (messages.length) setNotice(messages.join(" "));
    if (accepted.length === 0) return;

    const next: BatchItem[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      objectUrl: URL.createObjectURL(file),
      title: "",
      caption: "",
      status: "idle",
      requestId: crypto.randomUUID(),
    }));
    setItems((prev) => [...prev, ...next]);
    setSelectedId((cur) => cur ?? next[0].id);
  };

  // Paste images straight from the clipboard.
  const addFilesRef = useRef(addFiles);
  useEffect(() => {
    addFilesRef.current = addFiles;
  });
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      addFilesRef.current(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const patchItem = (id: string, patch: Partial<BatchItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const removeItem = (id: string) => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;
    URL.revokeObjectURL(items[idx].objectUrl);
    const rest = items.filter((i) => i.id !== id);
    setItems(rest);
    if (selectedId === id) setSelectedId((rest[idx] ?? rest[idx - 1])?.id ?? null);
  };

  const clearAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.objectUrl));
    setItems([]);
    setSelectedId(null);
    setNotice("");
    setError("");
    setSpaceLimitReached(false);
  };

  const setCaption = (id: string, value: string) => {
    if (value.split("\n").length > SHARED_LIMITS.descriptionLines) return;
    if (value.length > SHARED_LIMITS.description) return;
    setCaptionApplied(false);
    patchItem(id, { caption: value });
  };

  const setTitle = (id: string, value: string) =>
    patchItem(id, { title: value.slice(0, SHARED_LIMITS.title) });

  const applyCaptionToAll = (caption: string) => {
    setItems((prev) => prev.map((i) => (i.status === "done" ? i : { ...i, caption })));
    setCaptionApplied(true);
  };

  const publishAll = async () => {
    setError("");
    setNotice("");
    setSpaceLimitReached(false);

    const userId = await getCurrentUserId();
    if (!userId) {
      setError(cb.mustBeLoggedIn);
      return;
    }

    const queue = itemsRef.current.filter((i) => i.status !== "done");
    if (queue.length === 0) return;
    setPublishing(true);
    queue.forEach((i) => patchItem(i.id, { status: "working", errorMessage: undefined }));

    // Uploads run a few at a time; publishes then go strictly in selection
    // order so the photos land on the profile in the order they were picked.
    const limit = createLimiter(UPLOAD_CONCURRENCY);
    const uploads = queue.map((item) =>
      item.imageUrl
        ? Promise.resolve(item.imageUrl)
        : limit(async () => {
            // Downscale + re-encode in the browser before it leaves the device.
            const ready = await compressImage(item.file);
            if (!isUploadableImage(ready)) throw new UnsupportedImageError();
            return uploadSpaceImage(userId, ready);
          }).then((url) => {
            patchItem(item.id, { imageUrl: url });
            return url;
          })
    );
    uploads.forEach((p) => p.catch(() => {})); // settled individually below

    let limitHit = false;
    let done = 0;
    let failed = 0;
    for (let n = 0; n < queue.length; n++) {
      const item = queue[n];
      if (limitHit) {
        patchItem(item.id, { status: "idle" });
        continue;
      }
      try {
        const imageUrl = await uploads[n];
        const latest = itemsRef.current.find((i) => i.id === item.id);
        const caption = latest?.caption.trim() ?? "";
        const payload: PublishSpacePayload = {
          content_type: "image",
          title: latest?.title.trim() ?? "",
          description: caption || null,
          image_url: imageUrl,
          preview_image_url: imageUrl,
          url: null,
          html_url: null,
          pdf_url: null,
          video_url: null,
          markdown_content: null,
          preview_gradient: DEFAULT_GRADIENT,
          preview_title: null,
          is_public: isPublic,
          hashtags,
        };
        const res = await publishSpaceItem(payload, item.requestId, collectionId);
        if (!res.ok) {
          if (res.error === "SPACE_LIMIT_REACHED") {
            limitHit = true;
            patchItem(item.id, { status: "idle" });
            continue;
          }
          throw new Error(res.message || res.error);
        }
        patchItem(item.id, { status: "done" });
        done++;
      } catch (err) {
        console.error("[image-batch] publish failed:", err);
        patchItem(item.id, {
          status: "error",
          errorMessage: err instanceof UnsupportedImageError ? cb.imageBatchUnsupported : undefined,
        });
        failed++;
      }
    }

    setPublishing(false);

    if (!limitHit && failed === 0) {
      await revalidateContents();
      router.push(collectionId ? `/dashboard/collections/${collectionId}` : "/dashboard/contents");
      return;
    }
    if (limitHit) {
      setSpaceLimitReached(true);
      if (done > 0) setNotice(cb.imageBatchPartialLimit.replace("{done}", String(done)));
    } else {
      setError(cb.imageBatchFailedNotice.replace("{count}", String(failed)));
    }
  };

  const total = items.length;
  const doneCount = items.filter((i) => i.status === "done").length;
  const failedCount = items.filter((i) => i.status === "error").length;
  const pendingCount = total - doneCount;
  const selectedIndex = items.findIndex((i) => i.id === selectedId);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  const submitLabel = publishing
    ? cb.imageBatchPublishing.replace("{done}", String(Math.min(doneCount + 1, total))).replace("{total}", String(total))
    : failedCount > 0 && failedCount === pendingCount
    ? cb.imageBatchRetryFailed.replace("{count}", String(failedCount))
    : pendingCount <= 1
    ? cb.imageBatchPublishOne
    : cb.imageBatchPublishMany.replace("{count}", String(pendingCount));

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };
  const dragProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      if (!publishing) setDragOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
    },
    onDrop,
  };

  return (
    <Card className="w-full max-w-2xl shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Images className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle className="text-xl">{cb.newTitle.replace("{type}", getContentTypeLabel(t, "image"))}</CardTitle>
            <CardDescription>{getContentTypeDescription(t, "image")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {total === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            {...dragProps}
            className={`group w-full rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-[border-color,background-color,transform] duration-200 ease-out active:scale-[0.99] ${
              dragOver
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
                : "border-border/60 hover:border-violet-400/60 hover:bg-muted/40"
            }`}
          >
            <div
              className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40 transition-transform duration-200 ease-out ${
                dragOver ? "scale-110" : "group-hover:scale-105"
              }`}
            >
              <ImagePlus className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-base font-semibold text-foreground">{cb.imageBatchDropTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {cb.dropzoneOr}{" "}
              <span className="text-violet-600 dark:text-violet-400 underline underline-offset-2">{cb.dropzoneBrowse}</span>. {cb.imageBatchDropHint}
            </p>
            <p className="mt-3 text-[11px] text-muted-foreground/70">{cb.imageBatchPasteHint}</p>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {cb.imageBatchSelected.replace("{count}", String(total))}
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">/ {MAX_BATCH}</span>
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={clearAll} disabled={publishing} className="text-xs text-muted-foreground">
                {cb.imageBatchClearAll}
              </Button>
            </div>

            {/* Thumbnail grid — also a drop target for adding more. */}
            <div
              {...dragProps}
              className={`grid max-h-[19rem] grid-cols-4 gap-2 overflow-y-auto rounded-xl p-1 -m-1 transition-colors sm:grid-cols-5 ${
                dragOver ? "bg-violet-50 ring-2 ring-violet-500/60 dark:bg-violet-950/30" : ""
              }`}
            >
              {items.map((item, idx) => {
                const isSelected = item.id === selectedId;
                return (
                  <div key={item.id} className="group relative aspect-square animate-in fade-in zoom-in-95 duration-200">
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      aria-label={cb.imageBatchCaptionFor.replace("{index}", String(idx + 1)).replace("{total}", String(total))}
                      aria-pressed={isSelected}
                      className={`relative block h-full w-full overflow-hidden rounded-lg bg-muted transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none ${
                        isSelected
                          ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-background"
                          : "ring-1 ring-border/60 hover:ring-violet-400/60"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.objectUrl} alt="" className="h-full w-full object-cover" draggable={false} />

                      {(item.title.trim() || item.caption.trim()) && item.status !== "done" && (
                        <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                          <MessageSquareText className="h-3 w-3 text-white" />
                        </span>
                      )}

                      {item.status === "working" && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[1px]">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </span>
                      )}
                      {item.status === "done" && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/35 animate-in fade-in duration-200">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 shadow-md animate-in zoom-in-75 duration-200">
                            <Check className="h-4 w-4 text-white" strokeWidth={3} />
                          </span>
                        </span>
                      )}
                      {item.status === "error" && (
                        <span className="absolute inset-0 flex items-center justify-center bg-destructive/45">
                          <AlertCircle className="h-6 w-6 text-white drop-shadow" />
                        </span>
                      )}
                    </button>

                    {!publishing && item.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={cb.imageBatchRemove}
                        title={cb.imageBatchRemove}
                        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-[opacity,transform] duration-150 ease-out active:scale-90 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {total < MAX_BATCH && !publishing && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  aria-label={cb.imageBatchAddMore}
                  className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border/60 text-muted-foreground transition-[border-color,color,transform] duration-150 ease-out hover:border-violet-400/60 hover:text-violet-600 active:scale-[0.97] dark:hover:text-violet-400"
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{cb.imageBatchAddMore}</span>
                </button>
              )}
            </div>

            {/* Caption editor for the selected photo (master–detail). */}
            {selected && (
              <div key={selected.id} className="flex gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 animate-in fade-in duration-150">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selected.objectUrl} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="batch-title" className="text-xs">
                    {cb.imageBatchTitleLabel}
                    {total > 1 && (
                      <span className="ml-1.5 font-normal text-muted-foreground">
                        · {cb.imageBatchCaptionFor.replace("{index}", String(selectedIndex + 1)).replace("{total}", String(total))}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="batch-title"
                    value={selected.title}
                    maxLength={SHARED_LIMITS.title}
                    disabled={publishing || selected.status === "done"}
                    placeholder={cb.imageBatchTitlePlaceholder}
                    onChange={(e) => setTitle(selected.id, e.target.value)}
                    className="h-8 bg-background/60 border-border/60 text-sm focus:border-violet-500/50 focus:bg-background transition-colors"
                  />
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Label htmlFor="batch-caption" className="text-xs">
                      {cb.imageBatchCaptionLabel}
                    </Label>
                    <span
                      className={`text-[11px] tabular-nums ${
                        selected.caption.length >= SHARED_LIMITS.description ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {selected.caption.length}/{SHARED_LIMITS.description}
                    </span>
                  </div>
                  <Textarea
                    id="batch-caption"
                    rows={2}
                    value={selected.caption}
                    disabled={publishing || selected.status === "done"}
                    placeholder={cb.imageBatchCaptionPlaceholder}
                    onChange={(e) => setCaption(selected.id, e.target.value)}
                    className="min-h-0 resize-none bg-background/60 border-border/60 text-sm focus:border-violet-500/50 focus:bg-background transition-colors"
                  />
                  {selected.status === "error" && selected.errorMessage && (
                    <p className="flex items-center gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {selected.errorMessage}
                    </p>
                  )}
                  {total > 1 && selected.caption.trim() && !publishing && (
                    <button
                      type="button"
                      onClick={() => applyCaptionToAll(selected.caption)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 transition-colors hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      {captionApplied ? <Check className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
                      {captionApplied ? cb.imageBatchCaptionApplied : cb.imageBatchApplyCaptionAll}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {notice && <p className="text-xs text-muted-foreground animate-in fade-in duration-150">{notice}</p>}

        <div className="space-y-2">
          <Label>{cb.hashtagsLabel}</Label>
          <p className="text-xs text-muted-foreground">
            {cb.hashtagsHint}
            {total > 1 && <> · {cb.imageBatchSharedHint}</>}
          </p>
          <HashtagPicker suggestions={hashtagSuggestions} selectedHashtags={hashtags} onChange={setHashtags} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-muted/40 border border-border/50">
            <Switch id="isPublic" checked={isPublic} onCheckedChange={setIsPublic} disabled={publishing} />
            <Label htmlFor="isPublic" className="font-normal cursor-pointer">
              {cb.showOnProfileLabel}
            </Label>
          </div>
          {isPublic && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
              <Globe className="h-4 w-4 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-400">{cb.publicNotice}</p>
            </div>
          )}
        </div>

        {spaceLimitReached && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{t.plan.spaceLimitTitle}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t.plan.spaceLimitReached}</p>
            <Link
              href="/dashboard/subscription"
              className="inline-flex items-center mt-2 text-sm font-semibold text-amber-900 dark:text-amber-200 underline underline-offset-2"
            >
              {t.plan.upgradeCta}
            </Link>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="space-y-3 pt-2">
          {publishing && total > 1 && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-violet-500 transition-[width] duration-300 ease-out"
                style={{ width: `${(doneCount / total) * 100}%` }}
              />
            </div>
          )}
          <div className="flex gap-3">
            <Button type="button" onClick={publishAll} disabled={publishing || pendingCount === 0} className="gap-1.5">
              {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={publishing}
              className="border-border/60 hover:border-violet-500/50 transition-colors"
            >
              {t.common.cancel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
