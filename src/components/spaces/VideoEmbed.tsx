"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type VideoInfo = {
  platform: "youtube" | "vimeo" | "loom";
  embedUrl: string;
};

export function detectVideo(url: string): VideoInfo | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return {
      platform: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`,
    };
  }

  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      platform: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }

  const loomMatch = url.match(/loom\.com\/(?:share|embed)\/([a-f0-9A-F-]+)/);
  if (loomMatch) {
    return {
      platform: "loom",
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`,
    };
  }

  return null;
}

export function getYoutubeThumbnail(url: string): string | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg` : null;
}

export async function getVimeoThumbnail(url: string): Promise<string | null> {
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (!match) return null;
  try {
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${match[1]}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.thumbnail_url as string) ?? null;
  } catch {
    return null;
  }
}

interface VideoEmbedProps {
  url: string;
}

export function VideoEmbed({ url }: VideoEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const info = detectVideo(url);

  if (!info) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Unsupported video URL. Supported: YouTube, Vimeo, Loom.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        </div>
      )}
      <iframe
        src={info.embedUrl}
        title="Video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full border-0"
        style={{ opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
