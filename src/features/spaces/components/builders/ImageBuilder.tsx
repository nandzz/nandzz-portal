"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { ContentBuilderShell } from "./ContentBuilderShell";
import { useContentBuilderForm } from "../../hooks/useContentBuilderForm";
import { uploadSpaceImage } from "../../storage";
import { FileDropzone } from "./FileDropzone";
import { ImageBatchBuilder } from "./ImageBatchBuilder";
import type { BuilderFieldsProps } from "./types";

const MAX_CONTENT_IMAGE_SIZE = 5 * 1024 * 1024;

export function ImageBuilder({ space, collectionId }: BuilderFieldsProps) {
  // Creating supports many photos at once; editing stays single-image.
  if (!space) return <ImageBatchBuilder collectionId={collectionId} />;
  return <SingleImageEditor space={space} collectionId={collectionId} />;
}

function SingleImageEditor({ space, collectionId }: BuilderFieldsProps) {
  const { t } = useLanguage();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageFile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on file-clear; mirrors the pre-existing SpaceForm.tsx pattern.
      setImageObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImageObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const validate = (): string | null => {
    if (!imageFile && !space?.image_url) return t.contentBuilder.imageFileRequiredError;
    return null;
  };

  const buildTypePayload = async ({ userId }: { userId: string }) => {
    let image_url = space?.image_url || null;
    if (imageFile) {
      try {
        image_url = await uploadSpaceImage(userId, imageFile);
      } catch (uploadErr) {
        throw new Error(t.contentBuilder.imageUploadFailedPrefix + (uploadErr as Error).message);
      }
    }
    return {
      content_type: "image",
      image_url,
      url: null,
      html_url: null,
      pdf_url: null,
      video_url: null,
      markdown_content: null,
      // Auto-use the uploaded image as the preview thumbnail when the user
      // hasn't picked their own — resolved by useContentBuilderForm.
      ...(image_url ? { preview_image_url: image_url } : {}),
    };
  };

  const form = useContentBuilderForm({
    contentType: "image",
    space,
    collectionId,
    validate,
    buildTypePayload,
  });

  return (
    <ContentBuilderShell contentType="image" space={space} form={form} showPreviewSection={false}>
      <div className="space-y-4">
        {imageFile && imageObjectUrl ? (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-violet-400/50 bg-black aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageObjectUrl} alt={t.contentBuilder.previewLabel} className="w-full h-full object-contain" />
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
                onClick={() => setImageFile(null)}
                className="rounded-full p-1 hover:bg-violet-100 dark:hover:bg-violet-900 transition-colors"
              >
                <X className="h-4 w-4 text-violet-500" />
              </button>
            </div>
          </div>
        ) : space?.image_url ? (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden border border-border/60 bg-black aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={space.image_url} alt={t.contentBuilder.imageCurrentImage} className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{t.contentBuilder.imageCurrentImage}</p>
              <UploadNewImageButton onFileSelected={setImageFile} onError={form.setError} />
            </div>
          </div>
        ) : (
          <FileDropzone
            accept="image/*"
            maxSizeBytes={MAX_CONTENT_IMAGE_SIZE}
            maxSizeErrorMessage={t.contentBuilder.imageMaxSizeError}
            mimeCheck={(file) => file.type.startsWith("image/")}
            mimeErrorMessage={t.contentBuilder.imageMimeError}
            icon={ImageIcon}
            title={t.contentBuilder.imageDropzoneTitle}
            hint={t.contentBuilder.imageDropzoneHint}
            onFileSelected={setImageFile}
            onError={form.setError}
          />
        )}
      </div>
    </ContentBuilderShell>
  );
}

/** "Replace" trigger shown over an existing image (edit mode). Reuses the
 * same hidden-input pattern as FileDropzone without the drag/drop surface. */
function UploadNewImageButton({
  onFileSelected,
  onError,
}: {
  onFileSelected: (file: File) => void;
  onError: (message: string) => void;
}) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (!file.type.startsWith("image/")) {
            onError(t.contentBuilder.imageMimeError);
            return;
          }
          if (file.size > MAX_CONTENT_IMAGE_SIZE) {
            onError(t.contentBuilder.imageMaxSizeError);
            return;
          }
          onFileSelected(file);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        className="gap-1.5 text-xs"
      >
        <UploadCloud className="h-3.5 w-3.5" />
        {t.contentBuilder.imageReplace}
      </Button>
    </>
  );
}
