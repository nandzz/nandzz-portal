"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MentionPopover } from "./MentionPopover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface CommentInputProps {
  userId: string | null;
  currentProfile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
}

function detectMention(value: string, cursor: number): string | null {
  const before = value.slice(0, cursor);
  const lastAt = before.lastIndexOf("@");
  if (lastAt === -1) return null;
  const query = before.slice(lastAt + 1);
  // Cancel if there's whitespace between @ and cursor (mention already resolved)
  if (/\s/.test(query)) return null;
  return query;
}

export function CommentInput({
  userId,
  currentProfile,
  onSubmit,
  placeholder = "Write a comment…",
  autoFocus = false,
  onCancel,
}: CommentInputProps) {
  const { t } = useLanguage();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!userId) {
    return (
      <div className="px-4 py-3 border-t">
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-violet-600 hover:underline font-medium">
            {t.comment.logIn}
          </Link>{" "}
          {t.comment.joinConversation}
        </p>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    // auto-grow
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 128) + "px";
    // @mention detection
    const cursor = e.target.selectionStart ?? val.length;
    setMentionQuery(detectMention(val, cursor));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      if (mentionQuery !== null) {
        setMentionQuery(null);
        return;
      }
      onCancel?.();
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const insertMention = (username: string) => {
    const cursor = textareaRef.current?.selectionStart ?? content.length;
    const before = content.slice(0, cursor);
    const lastAt = before.lastIndexOf("@");
    const newContent =
      content.slice(0, lastAt) + "@" + username + " " + content.slice(cursor);
    setContent(newContent);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const newCursor = lastAt + username.length + 2; // @ + username + space
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(newCursor, newCursor);
      // re-grow after content change
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 128) + "px";
    });
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSubmitting(false);
    }
  };

  const initials =
    (currentProfile?.display_name || currentProfile?.username || "U")[0]?.toUpperCase() ?? "U";

  return (
    <div className="px-3 py-3 border-t bg-background">
      <div className="flex gap-2.5">
        <Avatar className="h-7 w-7 shrink-0 mt-0.5">
          <AvatarImage src={currentProfile?.avatar_url || undefined} />
          <AvatarFallback className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 relative">
          {mentionQuery !== null && (
            <MentionPopover query={mentionQuery} onSelect={insertMention} />
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            maxLength={1000}
            rows={1}
            className="w-full resize-none overflow-hidden rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all"
            style={{ minHeight: "2.25rem" }}
          />
          <div className="flex items-center justify-between mt-1.5">
            <span
              className={cn(
                "text-xs",
                content.length > 900 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {content.length > 800 ? `${content.length}/1000` : ""}
            </span>
            <div className="flex items-center gap-1.5">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded transition-colors"
                >
                  {t.comment.cancel}
                </button>
              )}
              <button
                type="button"
                disabled={!content.trim() || submitting}
                onClick={() => void handleSubmit()}
                className="text-xs font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1 rounded-md transition-colors"
              >
                {submitting ? t.comment.posting : t.comment.post}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
