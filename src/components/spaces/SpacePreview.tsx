import Image from "next/image";
import type { Space } from "@/lib/types";
import { getGradient } from "@/lib/preview-gradients";

interface SpacePreviewProps {
  space: Space;
}

export function SpacePreview({ space }: SpacePreviewProps) {
  const previewSrc = space.preview_image_url ?? space.image_url;

  if (previewSrc) {
    return (
      <Image
        src={previewSrc}
        alt={space.title}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover transition-transform group-hover:scale-105"
      />
    );
  }

  const gradient = getGradient(space.preview_gradient);

  return (
    <div className={`flex h-full w-full items-center justify-center ${gradient.bg}`}>
      {space.preview_title ? (
        <span className={`w-full text-center text-base @[200px]:text-xl @[320px]:text-3xl font-bold leading-tight px-4 line-clamp-3 ${gradient.text}`}>
          {space.preview_title}
        </span>
      ) : (
        <span className={`text-lg @[200px]:text-xl @[320px]:text-3xl font-bold ${gradient.text}`}>
          {space.title[0]?.toUpperCase()}
        </span>
      )}
    </div>
  );
}
