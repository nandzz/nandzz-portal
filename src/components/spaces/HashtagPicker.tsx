"use client";

import { useState, useRef, useEffect } from "react";
import { X, Hash } from "lucide-react";

const MAX_HASHTAGS = 3;
const MAX_HASHTAG_LENGTH = 30;

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface HashtagPickerProps {
  suggestions: string[];
  selectedHashtags: string[];
  onChange: (hashtags: string[]) => void;
}

export function HashtagPicker({ suggestions, selectedHashtags, onChange }: HashtagPickerProps) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const rawQuery = inputValue.replace(/^#/, "").trim();
  const slug = toSlug(rawQuery);

  const filtered = suggestions.filter((s) => !selectedHashtags.includes(s));

  const matches = slug
    ? filtered.filter((s) => s.includes(slug)).slice(0, 6)
    : filtered.slice(0, 6);

  const exactMatch = suggestions.includes(slug);
  const canCreate =
    slug.length >= 2 &&
    slug.length <= MAX_HASHTAG_LENGTH &&
    !exactMatch &&
    !selectedHashtags.includes(slug);

  const add = (hashtag: string) => {
    if (selectedHashtags.length >= MAX_HASHTAGS) return;
    onChange([...selectedHashtags, hashtag]);
    setInputValue("");
    setOpen(false);
  };

  const remove = (hashtag: string) => {
    onChange(selectedHashtags.filter((h) => h !== hashtag));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="space-y-2" ref={containerRef}>
      {selectedHashtags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedHashtags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/50 border border-violet-300 dark:border-violet-700 px-3 py-1 text-sm font-medium text-violet-700 dark:text-violet-300"
            >
              <Hash className="h-3 w-3" />
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-violet-200 dark:hover:bg-violet-800 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {selectedHashtags.length < MAX_HASHTAGS && (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/50 px-3 py-2 focus-within:border-violet-500/50 focus-within:bg-background transition-colors">
            <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value.slice(0, MAX_HASHTAG_LENGTH + 1));
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (exactMatch) add(slug);
                  else if (matches[0] && !canCreate) add(matches[0]);
                  else if (canCreate) add(slug);
                }
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Backspace" && !inputValue && selectedHashtags.length > 0) {
                  remove(selectedHashtags[selectedHashtags.length - 1]);
                }
              }}
              placeholder={`Search or create a hashtag (${MAX_HASHTAGS - selectedHashtags.length} left)`}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            />
          </div>

          {open && (matches.length > 0 || canCreate) && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border/60 bg-background shadow-lg overflow-hidden">
              {matches.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); add(tag); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                >
                  <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>{tag}</span>
                </button>
              ))}
              {canCreate && (
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); add(slug); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-violet-50 dark:hover:bg-violet-950/30 text-violet-700 dark:text-violet-300 transition-colors border-t border-border/40 text-left"
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  <span>Create <strong>#{slug}</strong></span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
