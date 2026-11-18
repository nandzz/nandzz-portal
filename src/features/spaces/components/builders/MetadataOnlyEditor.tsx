"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { ContentBuilderShell } from "./ContentBuilderShell";
import { useContentBuilderForm } from "../../hooks/useContentBuilderForm";
import type { BuilderFieldsProps } from "./types";

/**
 * Metadata-only editor for legacy `html` spaces (including old AI-generated
 * pages). There is no per-type builder for `html` — its content is edited
 * in-place from the content page's Edit / AI Edit buttons — but the owner
 * can still edit the shared metadata (title, hashtags, description, preview,
 * visibility) here, through the same shell/hook plumbing every other
 * builder uses. Always an edit surface: `space` is required in practice
 * (edit-space/[id] is the only caller), never used for creation.
 */
export function MetadataOnlyEditor({ space }: BuilderFieldsProps) {
  const { t } = useLanguage();
  const validate = (): string | null => null;

  // Only shared metadata columns are touched here — deliberately does NOT
  // set html_url or any other type-specific column, so existing content
  // (and every other legacy type's data) is preserved untouched on save.
  const buildTypePayload = async () => ({ content_type: "html" as const });

  const form = useContentBuilderForm({
    contentType: "html",
    space,
    validate,
    buildTypePayload,
  });

  return (
    <ContentBuilderShell contentType="html" space={space} form={form}>
      <p className="text-xs text-muted-foreground rounded-lg bg-muted/40 border border-border/50 px-3 py-2.5">
        {t.contentMetadataEditor.note.replace("{edit}", t.space.edit)}
      </p>
    </ContentBuilderShell>
  );
}
