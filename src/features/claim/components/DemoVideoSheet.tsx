"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { demoNotice, useDemoNotice } from "../lib/demo-notice-store";

/**
 * The demo's pitch video (their own back-office, narrated), shown when the
 * business opens its demo page. Opens by itself on every visit, and again
 * from the "Watch the video" link in DemoNoticeSheet. Gone after the claim
 * (the video is deleted with the demo).
 *
 * Browsers only autoplay muted: it starts muted with a "Tap for sound" chip.
 * When the browser still refuses (iOS Low Power Mode, data saver, site
 * settings), a play button starts it with sound on the visitor's tap.
 */
export function DemoVideoSheet({ username, src }: { username: string; src: string }) {
  const { videoOpen } = useDemoNotice();

  // Every visit to the demo page. The layout stays mounted while moving between
  // the profile's own routes, so it doesn't reopen on each of those.
  useEffect(() => {
    demoNotice.openVideo();
  }, [username]);

  return videoOpen ? <VideoDialog src={src} /> : null;
}

// Mounted only while open, so every opening starts muted from the top.
function VideoDialog({ src }: { src: string }) {
  const { t } = useLanguage();
  const c = t.demoNotice;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const close = demoNotice.closeVideo;

  // React sets `muted` only as a property, never as the attribute, and Safari
  // won't autoplay a video without it. Mute it for real and start it ourselves.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.defaultMuted = true;
    v.muted = true;
    v.play().catch(() => setBlocked(true));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close]);

  const toggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.ended) v.currentTime = 0;
    if (!v.muted) void v.play();
    setMuted(v.muted);
  };

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    void v.play();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={c.watchVideo}
        className="relative z-10 flex max-h-full flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-300 motion-reduce:animate-none"
      >
        <div className="relative aspect-[9/16] h-[min(78dvh,calc((100vw-2rem)*16/9))] overflow-hidden rounded-[1.75rem] bg-black shadow-2xl">
          <video
            ref={videoRef}
            src={src}
            autoPlay
            muted
            playsInline
            preload="auto"
            onPlay={() => setBlocked(false)}
            onClick={toggleSound}
            className="h-full w-full cursor-pointer object-cover"
          />
          {blocked && (
            <button
              type="button"
              onClick={toggleSound}
              aria-label={c.watchVideo}
              className="absolute inset-0 flex items-center justify-center bg-black/30"
            >
              <span className="rounded-full bg-white/90 p-5 text-black shadow-xl transition-transform active:scale-95">
                <Play className="h-8 w-8 translate-x-0.5 fill-current" aria-hidden />
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label={c.close}
            className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white backdrop-blur transition-colors hover:bg-black/70"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={replay}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-black/75"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {c.replay}
            </button>
            <button
              type="button"
              onClick={toggleSound}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-black/75"
            >
              {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
              {muted ? c.tapForSound : c.mute}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={demoNotice.open}
          className="h-12 rounded-full bg-violet-600 px-6 text-base font-semibold text-white shadow-lg transition-[transform,background-color] hover:bg-violet-500 active:scale-[0.98]"
        >
          {c.videoCta}
        </button>
        <button
          type="button"
          onClick={demoNotice.openWhy}
          className="-mt-1 text-sm text-white/80 underline underline-offset-4 transition-colors hover:text-white"
        >
          {c.whyButton}
        </button>
      </div>
    </div>,
    document.body
  );
}
