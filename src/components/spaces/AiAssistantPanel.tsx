"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Send, Loader2, RefreshCw, Clock, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { createClient } from "@/lib/supabase/client";

// ─── File attachments ─────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARS = 50_000;
const MAX_ATTACHMENTS = 3;

const TEXT_EXTS = /\.(txt|md|html?|css|js|ts|jsx|tsx|json|xml|csv|py|rb|go|rs|java|kt|swift|sh|yaml|yml|toml|sql)$/i;

// "text" = read as UTF-8 string; "binary" = read as base64 + preserve MIME type
type FileAttachment = {
  id: string;
  name: string;
  type: "text" | "binary";
  content?: string;   // text files
  data?: string;      // base64, binary files
  mediaType?: string; // MIME type for binary files
};

function readFileAsAttachment(file: File, onTooLarge: () => void): Promise<FileAttachment | null> {
  return new Promise((resolve) => {
    if (file.size > MAX_FILE_BYTES) { onTooLarge(); resolve(null); return; }

    const id = crypto.randomUUID();

    if (file.type.startsWith("text/") || TEXT_EXTS.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => {
        let content = reader.result as string;
        if (content.length > MAX_TEXT_CHARS) content = content.slice(0, MAX_TEXT_CHARS) + "\n…[truncated]";
        resolve({ id, name: file.name, type: "text", content });
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    } else {
      // Everything else (images, PDFs, Office docs, spreadsheets, zips…)
      // is read as binary and uploaded as-is to the agent's session environment.
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const comma = dataUrl.indexOf(",");
        const mediaType = file.type || "application/octet-stream";
        resolve({ id, name: file.name, type: "binary", data: dataUrl.slice(comma + 1), mediaType });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    }
  });
}

// ─── State machine ────────────────────────────────────────────────────────────

type AiEditState =
  | { status: "idle"; instruction: string }
  | { status: "loading"; instruction: string }
  | { status: "submitted"; instruction: string }
  | { status: "error"; instruction: string; message: string; canRetry: boolean };

type AiEditAction =
  | { type: "SET_INSTRUCTION"; instruction: string }
  | { type: "SUBMIT" }
  | { type: "SUBMITTED" }
  | { type: "DISCARD" }
  | { type: "ERROR"; message: string; canRetry: boolean }
  | { type: "RETRY" };

function reducer(state: AiEditState, action: AiEditAction): AiEditState {
  switch (action.type) {
    case "SET_INSTRUCTION":
      if (state.status === "idle" || state.status === "error") {
        return { ...state, status: "idle", instruction: action.instruction };
      }
      return state;
    case "SUBMIT":
      if (state.status === "idle" || state.status === "error") {
        return { status: "loading", instruction: state.instruction };
      }
      return state;
    case "SUBMITTED":
      if (state.status === "loading") {
        return { status: "submitted", instruction: state.instruction };
      }
      return state;
    case "DISCARD":
      return { status: "idle", instruction: state.status !== "loading" ? state.instruction : "" };
    case "ERROR":
      return {
        status: "error",
        instruction: state.status === "loading" || state.status === "submitted"
          ? state.instruction
          : "",
        message: action.message,
        canRetry: action.canRetry,
      };
    case "RETRY":
      if (state.status === "error") {
        return { status: "loading", instruction: state.instruction };
      }
      return state;
    default:
      return state;
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AiAssistantPanelProps {
  spaceId: string;
  htmlUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

// ─── Panel header ─────────────────────────────────────────────────────────────

function PanelHeader({ title, onClose, closeable }: { title: string; onClose: () => void; closeable: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={!closeable}
        className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="Close AI assistant"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiAssistantPanel({ spaceId, htmlUrl, isOpen, onClose }: AiAssistantPanelProps) {
  const { t } = useLanguage();
  const ai = t.aiAssistant;

  const [state, dispatch] = useReducer(reducer, { status: "idle", instruction: "" });
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [fileTooLargeError, setFileTooLargeError] = useState(false);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);

  const errMap: Record<string, string> = {
    ai_unavailable: ai.errorUnavailable,
    ai_invalid_output: ai.errorInvalid,
    html_too_large: ai.errorTooLarge,
    html_not_found: ai.errorGeneric,
  };

  // Portal mount/unmount with transition
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset to idle when reopened (keeps instruction for convenience)
  useEffect(() => {
    if (isOpen && state.status === "submitted") {
      dispatch({ type: "DISCARD" });
      setSubmittedJobId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.status !== "loading") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, state.status, onClose]);

  // Watch the submitted job — surface errors inline so the panel doesn't hang on
  // "working in background" forever if the edge function fails.
  useEffect(() => {
    if (!submittedJobId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`ai-edit-job-${submittedJobId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "ai_edit_jobs",
        filter: `id=eq.${submittedJobId}`,
      }, (payload) => {
        const job = payload.new as { status: string; error_code?: string };
        if (job.status === "error") {
          dispatch({
            type: "ERROR",
            message: errMap[job.error_code ?? ""] ?? ai.errorGeneric,
            canRetry: true,
          });
          setSubmittedJobId(null);
        } else if (job.status === "done") {
          setSubmittedJobId(null);
        }
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedJobId]);

  // ── Submit handler ──────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setFileTooLargeError(false);
    const available = MAX_ATTACHMENTS - attachments.length;
    const toProcess = files.slice(0, available);
    const results = await Promise.all(
      toProcess.map((f) => readFileAsAttachment(f, () => setFileTooLargeError(true)))
    );
    const valid = results.filter((a): a is FileAttachment => a !== null);
    if (valid.length > 0) setAttachments((prev) => [...prev, ...valid].slice(0, MAX_ATTACHMENTS));
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setFileTooLargeError(false);
  }

  async function handleSubmit() {
    if (state.status !== "idle" && state.status !== "error") return;
    const instruction = state.instruction.trim();
    if (!instruction) return;

    dispatch({ type: "SUBMIT" });

    try {
      console.log("[ai-edit] submitting for space", spaceId);
      const payload = {
        instruction,
        htmlUrl,
        ...(attachments.length > 0 && {
          attachments: attachments.map(({ name, type, content, data, mediaType }) => ({ name, type, content, data, mediaType })),
        }),
      };
      const res = await fetch(`/api/spaces/${spaceId}/ai-edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[ai-edit] response", res.status);

      if (res.status === 402) {
        dispatch({ type: "ERROR", message: ai.errorInsufficientCredits, canRetry: false });
        return;
      }
      if (res.status === 429) {
        dispatch({ type: "ERROR", message: ai.errorQuota, canRetry: false });
        return;
      }
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error("[ai-edit] error", res.status, errBody);
        dispatch({ type: "ERROR", message: ai.errorGeneric, canRetry: true });
        return;
      }

      const { jobId } = await res.json();
      console.log("[ai-edit] job started:", jobId);
      setAttachments([]);
      setFileTooLargeError(false);
      setSubmittedJobId(jobId);
      dispatch({ type: "SUBMITTED" });
    } catch (err) {
      console.error("[ai-edit] submit error:", err);
      dispatch({ type: "ERROR", message: ai.errorGeneric, canRetry: true });
    }
  }

  const closeable = state.status !== "loading";
  const instruction = state.status !== "loading" ? state.instruction : "";

  if (!mounted) return null;

  const panelContent = (
    <>
      {/* ── Desktop: floating bottom-right panel ── */}
      <div
        className={cn(
          "fixed bottom-4 right-4 w-[380px] max-h-[calc(100dvh-6rem)] z-50 hidden md:flex flex-col bg-background border rounded-xl shadow-2xl transition-all duration-300 ease-in-out origin-bottom-right",
          visible
            ? "translate-y-0 opacity-100 scale-100"
            : "translate-y-4 opacity-0 scale-95 pointer-events-none"
        )}
        role="dialog"
        aria-label={ai.panelTitle}
      >
        <PanelHeader title={ai.panelTitle} onClose={onClose} closeable={closeable} />
        <PanelBody
          state={state}
          ai={ai}
          instruction={instruction}
          onInstructionChange={(v) => dispatch({ type: "SET_INSTRUCTION", instruction: v })}
          onSubmit={handleSubmit}
          onDiscard={() => { dispatch({ type: "DISCARD" }); }}
          onRetry={() => { dispatch({ type: "RETRY" }); handleSubmit(); }}
          onClose={onClose}
          attachments={attachments}
          fileTooLargeError={fileTooLargeError}
          onFileChange={handleFileChange}
          onRemoveAttachment={removeAttachment}
        />
      </div>

      {/* ── Mobile: backdrop ── */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 md:hidden transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={closeable ? onClose : undefined}
        aria-hidden
      />

      {/* ── Mobile: bottom sheet ── */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 md:hidden flex flex-col bg-background rounded-t-2xl shadow-2xl transition-transform duration-300",
          visible ? "translate-y-0" : "translate-y-full"
        )}
        style={{ height: "60dvh" }}
        role="dialog"
        aria-modal="true"
        aria-label={ai.panelTitle}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <PanelHeader title={ai.panelTitle} onClose={onClose} closeable={closeable} />
        <PanelBody
          state={state}
          ai={ai}
          instruction={instruction}
          onInstructionChange={(v) => dispatch({ type: "SET_INSTRUCTION", instruction: v })}
          onSubmit={handleSubmit}
          onDiscard={() => { dispatch({ type: "DISCARD" }); }}
          onRetry={() => { dispatch({ type: "RETRY" }); handleSubmit(); }}
          onClose={onClose}
          attachments={attachments}
          fileTooLargeError={fileTooLargeError}
          onFileChange={handleFileChange}
          onRemoveAttachment={removeAttachment}
        />
      </div>
    </>
  );

  return createPortal(panelContent, document.body);
}

// ─── Panel body ────────────────────────────────────────────────────────────────

interface PanelBodyProps {
  state: AiEditState;
  ai: ReturnType<typeof useLanguage>["t"]["aiAssistant"];
  instruction: string;
  onInstructionChange: (v: string) => void;
  onSubmit: () => void;
  onDiscard: () => void;
  onRetry: () => void;
  onClose: () => void;
  attachments: FileAttachment[];
  fileTooLargeError: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (id: string) => void;
}

function PanelBody({ state, ai, instruction, onInstructionChange, onSubmit, onRetry, onClose, attachments, fileTooLargeError, onFileChange, onRemoveAttachment }: PanelBodyProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = state.status === "loading";
  const canAttach = attachments.length < MAX_ATTACHMENTS && !isLoading;

  // Submitted: working in background — user can close
  if (state.status === "submitted") {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Clock className="size-6 text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">{ai.submitted}</p>
          <p className="text-xs text-muted-foreground">{ai.submittedDesc}</p>
        </div>
        <p className="text-xs text-muted-foreground/70 italic max-w-[260px] truncate">
          "{state.instruction}"
        </p>
        <Button size="sm" className="mt-2" onClick={onClose}>
          {ai.discard}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
      {/* Loading spinner */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" />
          <span>{ai.submitting}</span>
        </div>
      )}

      {/* Error */}
      {state.status === "error" && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      {/* Textarea */}
      <Textarea
        value={instruction}
        onChange={(e) => onInstructionChange(e.target.value)}
        placeholder={ai.placeholder}
        className="flex-1 resize-none min-h-[120px]"
        disabled={isLoading}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (state.status === "idle" || state.status === "error") onSubmit();
          }
        }}
      />

      {/* File chips */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 text-xs rounded-full border border-border bg-muted px-2 py-0.5 max-w-[160px]"
            >
              <span className="truncate">{a.name}</span>
              {!isLoading && (
                <button
                  type="button"
                  onClick={() => onRemoveAttachment(a.id)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Remove file"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* File too large error */}
      {fileTooLargeError && (
        <p className="text-xs text-destructive">{ai.fileTooLarge}</p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="sr-only"
        onChange={onFileChange}
        disabled={!canAttach}
      />

      {/* Actions */}
      <div className="flex gap-2 shrink-0" style={{ paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}>
        {/* Attach button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          disabled={!canAttach}
          onClick={() => fileInputRef.current?.click()}
          title={ai.attachFile}
        >
          <Paperclip className="size-3.5" />
        </Button>

        {state.status === "error" && state.canRetry && (
          <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            {ai.retry}
          </Button>
        )}
        <Button
          size="sm"
          className="flex-1 gap-1.5"
          disabled={isLoading || !instruction.trim()}
          onClick={onSubmit}
        >
          {isLoading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              {ai.submitting}
            </>
          ) : (
            <>
              <Send className="size-3.5" />
              {ai.submit}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
