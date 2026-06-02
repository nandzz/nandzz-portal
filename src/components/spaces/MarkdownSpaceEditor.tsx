"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";

interface MarkdownSpaceEditorProps {
  spaceId: string;
  initialContent: string;
}

export function MarkdownSpaceEditor({ spaceId, initialContent }: MarkdownSpaceEditorProps) {
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [content, setContent] = useState(initialContent);
  const [draft, setDraft] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (mode === "edit") {
      textareaRef.current?.focus();
    }
  }, [mode]);

  const handleEdit = () => {
    setDraft(content);
    setError(null);
    setSaved(false);
    setMode("edit");
  };

  const handleCancel = () => {
    setDraft(content);
    setError(null);
    setMode("preview");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from("spaces")
        .update({ markdown_content: draft.trim() || null })
        .eq("id", spaceId);
      if (dbError) throw dbError;
      setContent(draft);
      setSaved(true);
      setMode("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-bar */}
      <div className="shrink-0 flex items-center justify-between gap-3 border-b bg-background/80 backdrop-blur-sm px-4 py-2">
        <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => mode === "edit" ? handleCancel() : undefined}
            className={`px-3 py-1.5 transition-colors ${
              mode === "preview"
                ? "bg-violet-600 text-white"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => mode === "preview" ? handleEdit() : undefined}
            className={`px-3 py-1.5 transition-colors ${
              mode === "edit"
                ? "bg-violet-600 text-white"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            Edit
          </button>
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <p className="text-xs text-destructive max-w-xs truncate">{error}</p>
          )}
          {saved && mode === "preview" && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">Saved</p>
          )}
          {mode === "edit" && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || draft === content}
              className="gap-1.5 h-7 text-xs px-3"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-3 w-3" />
                  Save
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {mode === "preview" ? (
          <MarkdownViewer content={content} />
        ) : (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-full w-full resize-none bg-background px-6 py-6 font-mono text-sm leading-relaxed focus:outline-none"
            placeholder="Write your markdown here…"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
}
