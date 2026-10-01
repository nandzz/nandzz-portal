"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommentsList } from "./CommentsList";
import type { CommentWithLike } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

interface CommentsPanelProps {
  open: boolean;
  onClose: () => void;
  spaceId: string;
  spaceOwnerId: string;
  userId: string | null;
  currentProfile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  initialComments: CommentWithLike[];
  initialHasMore: boolean;
  onCountChange: (delta: number) => void;
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
      <h2 className="text-sm font-semibold">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Close comments"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function CommentsPanel({
  open,
  onClose,
  spaceId,
  spaceOwnerId,
  userId,
  currentProfile,
  initialComments,
  initialHasMore,
  onCountChange,
}: CommentsPanelProps) {
  const { t } = useLanguage();
  // Mount the portal when open, unmount after the exit transition finishes.
  const [mounted, setMounted] = useState(false);
  // Flip visible on the next paint so CSS transitions play on entry and exit.
  const [visible, setVisible] = useState(false);
  // The desktop panel is portaled to <body>, so it can't inherit the space
  // viewer's layout. It must start flush with the bottom of the in-page top bar
  // (`.space-viewer-topbar`), whose height varies with its content — measure it
  // rather than hardcode, otherwise the content behind shows through the gap.
  const [topOffset, setTopOffset] = useState<number | null>(null);

  useEffect(() => {
    // Mount/unmount-with-transition pattern: sync mount + visibility to `open`
    // across paints. The synchronous setState here is intentional and drives the
    // enter/exit animation.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true))
      );
      return () => cancelAnimationFrame(id);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const bar = document.querySelector<HTMLElement>(".space-viewer-topbar");
    if (!bar) return;
    const measure = () => setTopOffset(bar.getBoundingClientRect().bottom);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bar);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const listProps = { spaceId, spaceOwnerId, userId, currentProfile, initialComments, initialHasMore, onCountChange };

  return createPortal(
    <>
      {/* ── Desktop: transparent backdrop (closes on outside click) ── */}
      <div
        className="fixed inset-0 z-40 hidden md:block"
        onClick={onClose}
        aria-hidden
      />

      {/* ── Desktop: right slide-in panel ── */}
      <div
        className={cn(
          "fixed right-0 bottom-0 w-[380px] z-50 hidden md:flex flex-col bg-background border-l shadow-2xl transition-transform duration-300 ease-in-out",
          visible ? "translate-x-0" : "translate-x-full"
        )}
        style={{ top: topOffset ?? 64 }}
      >
        <PanelHeader title={t.comment.panelTitle} onClose={onClose} />
        <CommentsList key="desktop" {...listProps} />
      </div>

      {/* ── Mobile: dark backdrop ── */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 md:hidden transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* ── Mobile: bottom sheet ── */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 md:hidden flex flex-col bg-background rounded-t-2xl shadow-2xl transition-transform duration-300",
          visible ? "translate-y-0" : "translate-y-full"
        )}
        style={{ height: "85dvh" }}
        role="dialog"
        aria-modal="true"
        aria-label={t.comment.panelTitle}
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <PanelHeader title={t.comment.panelTitle} onClose={onClose} />
        <CommentsList key="mobile" {...listProps} />
      </div>
    </>,
    document.body
  );
}
