"use client";

import { useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { UploadCloud } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface FileDropzoneProps {
  /** Native `<input accept>` attribute, e.g. "application/pdf,.pdf" or "image/*". */
  accept: string;
  maxSizeBytes: number;
  /** Shown when a dropped/selected file exceeds `maxSizeBytes`. */
  maxSizeErrorMessage: string;
  /** Optional extra check (e.g. MIME prefix) beyond size — return true if acceptable. */
  mimeCheck?: (file: File) => boolean;
  /** Shown when `mimeCheck` returns false. */
  mimeErrorMessage?: string;
  icon?: LucideIcon;
  title: string;
  hint: string;
  onFileSelected: (file: File) => void;
  onError: (message: string) => void;
  className?: string;
}

/**
 * Shared drag/drop + browse-to-upload target. Extracted from the PDF, HTML,
 * and Image upload blocks in the old SpaceForm.tsx (all three duplicated the
 * same interaction pattern). Renders only the "no file yet" empty state —
 * callers render their own "file selected" chip/preview UI.
 */
export function FileDropzone({
  accept,
  maxSizeBytes,
  maxSizeErrorMessage,
  mimeCheck,
  mimeErrorMessage,
  icon: Icon = UploadCloud,
  title,
  hint,
  onFileSelected,
  onError,
  className,
}: FileDropzoneProps) {
  const { t } = useLanguage();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (mimeCheck && !mimeCheck(file)) {
      onError(mimeErrorMessage ?? t.contentBuilder.dropzoneDefaultMimeError);
      return;
    }
    if (file.size > maxSizeBytes) {
      onError(maxSizeErrorMessage);
      return;
    }
    onFileSelected(file);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          // Allow re-selecting the same file after a remove.
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={`w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30"
            : "border-border/60 hover:border-violet-400/60 hover:bg-muted/40"
        } ${className ?? ""}`}
      >
        <Icon className={`mx-auto h-8 w-8 mb-3 ${dragOver ? "text-violet-500" : "text-muted-foreground"}`} />
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t.contentBuilder.dropzoneOr}{" "}
          <span className="text-violet-600 dark:text-violet-400 underline underline-offset-2">
            {t.contentBuilder.dropzoneBrowse}
          </span>. {hint}
        </p>
      </button>
    </>
  );
}
