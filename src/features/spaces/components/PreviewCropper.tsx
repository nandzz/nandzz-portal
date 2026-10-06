"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

const RATIO = 16 / 9;
const HANDLE_HIT = 16;
const MIN_W = 80;
const HANDLE_VIS = 12;

interface CropBox { x: number; y: number; w: number; h: number }
type CornerHandle = "nw" | "ne" | "se" | "sw";

interface DragState {
  mode: "move" | "resize";
  handle?: CornerHandle;
  startClientX: number;
  startClientY: number;
  startBox: CropBox;
}

interface PreviewCropperProps {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const CORNER_CURSORS: Record<CornerHandle, string> = {
  nw: "nw-resize",
  ne: "ne-resize",
  se: "se-resize",
  sw: "sw-resize",
};

function getCornerAt(px: number, py: number, box: CropBox): CornerHandle | null {
  const { x, y, w, h } = box;
  const near = (a: number, b: number) => Math.abs(a - b) <= HANDLE_HIT;
  if (near(px, x) && near(py, y)) return "nw";
  if (near(px, x + w) && near(py, y)) return "ne";
  if (near(px, x + w) && near(py, y + h)) return "se";
  if (near(px, x) && near(py, y + h)) return "sw";
  return null;
}

/**
 * Resize the crop box by dx while keeping a fixed 16:9 ratio.
 * The corner opposite the dragged handle stays anchored.
 */
function resizeWithRatio(
  handle: CornerHandle,
  dx: number,
  startBox: CropBox,
  maxW: number,
  maxH: number
): CropBox {
  const { x, y, w, h } = startBox;
  const isLeft = handle === "nw" || handle === "sw";
  const isTop  = handle === "nw" || handle === "ne";

  let nw = Math.max(MIN_W, isLeft ? w - dx : w + dx);

  // Maximum nw that keeps the box inside the canvas in both axes
  const maxByW = isLeft ? x + w : maxW - x;
  const maxByH = (isTop ? y + h : maxH - y) * RATIO;
  nw = Math.min(nw, maxByW, maxByH);
  nw = Math.max(MIN_W, nw);

  const nh = nw / RATIO;
  const nx = isLeft ? x + w - nw : x;
  const ny = isTop ? y + h - nh : y;

  return { x: nx, y: ny, w: nw, h: nh };
}

export function PreviewCropper({ imageSrc, onConfirm, onCancel }: PreviewCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [crop, setCrop] = useState<CropBox>({ x: 0, y: 0, w: 100, h: 100 / RATIO });
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const [initialized, setInitialized] = useState(false);
  const [cursor, setCursor] = useState("default");

  // Initialize a centered 16:9 crop once the image is loaded and container is sized
  const handleImageLoad = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    setContainerSize({ w: width, h: height });
    const cropW = Math.min(width * 0.9, height * 0.9 * RATIO);
    const cropH = cropW / RATIO;
    setCrop({
      x: (width - cropW) / 2,
      y: (height - cropH) / 2,
      w: cropW,
      h: cropH,
    });
    setInitialized(true);
  }, []);

  // Global move/up so dragging beyond the container edge stays smooth
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      const { x, y, w, h } = drag.startBox;
      const { w: maxW, h: maxH } = containerSize;

      if (drag.mode === "move") {
        setCrop({
          x: Math.max(0, Math.min(x + dx, maxW - w)),
          y: Math.max(0, Math.min(y + dy, maxH - h)),
          w,
          h,
        });
      } else {
        setCrop(resizeWithRatio(drag.handle!, dx, drag.startBox, maxW, maxH));
      }
    };

    const onUp = () => { dragRef.current = null; };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [containerSize]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const corner = getCornerAt(px, py, crop);
      if (corner) {
        setCursor(CORNER_CURSORS[corner]);
        dragRef.current = {
          mode: "resize",
          handle: corner,
          startClientX: e.clientX,
          startClientY: e.clientY,
          startBox: { ...crop },
        };
        return;
      }

      if (px >= crop.x && px <= crop.x + crop.w && py >= crop.y && py <= crop.y + crop.h) {
        setCursor("grabbing");
        dragRef.current = {
          mode: "move",
          startClientX: e.clientX,
          startClientY: e.clientY,
          startBox: { ...crop },
        };
      }
    },
    [crop]
  );

  const handlePointerMoveLocal = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragRef.current) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const corner = getCornerAt(px, py, crop);
      if (corner) {
        setCursor(CORNER_CURSORS[corner]);
      } else if (px >= crop.x && px <= crop.x + crop.w && py >= crop.y && py <= crop.y + crop.h) {
        setCursor("grab");
      } else {
        setCursor("default");
      }
    },
    [crop]
  );

  const handleConfirm = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container || img.naturalWidth === 0) return;

    const { width: dW, height: dH } = container.getBoundingClientRect();
    const scaleX = img.naturalWidth / dW;
    const scaleY = img.naturalHeight / dH;

    const sx = Math.round(crop.x * scaleX);
    const sy = Math.round(crop.y * scaleY);
    const sw = Math.max(1, Math.round(crop.w * scaleX));
    const sh = Math.max(1, Math.round(crop.h * scaleY));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    canvas.toBlob(
      (blob) => { if (blob) onConfirm(blob); },
      "image/jpeg",
      0.92
    );
  }, [crop, onConfirm]);

  const { x, y, w, h } = crop;

  const corners: { id: CornerHandle; cx: number; cy: number }[] = [
    { id: "nw", cx: x,     cy: y },
    { id: "ne", cx: x + w, cy: y },
    { id: "se", cx: x + w, cy: y + h },
    { id: "sw", cx: x,     cy: y + h },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Choose preview area</span>
        <span className="text-xs text-muted-foreground">Drag to move · Drag corners to resize · 16:9</span>
      </div>

      <div
        ref={containerRef}
        className="relative rounded-xl border border-border/60 overflow-hidden select-none touch-none"
        style={{ cursor }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMoveLocal}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob/data URL in a crop canvas; next/image cannot optimize it */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Preview source"
          className="block w-full h-auto"
          draggable={false}
          onLoad={handleImageLoad}
        />

        {initialized && (
          <>
            {/* Dark mask outside the crop box */}
            <div className="absolute inset-x-0 top-0 bg-black/50 pointer-events-none" style={{ height: y }} />
            <div className="absolute inset-x-0 bg-black/50 pointer-events-none" style={{ top: y + h, bottom: 0 }} />
            <div className="absolute bg-black/50 pointer-events-none" style={{ top: y, height: h, left: 0, width: x }} />
            <div className="absolute bg-black/50 pointer-events-none" style={{ top: y, height: h, left: x + w, right: 0 }} />

            {/* Crop border + rule-of-thirds grid */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: x, top: y, width: w, height: h,
                border: "2px solid white",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
              }}
            >
              <div className="absolute top-0 bottom-0 border-l border-white/25" style={{ left: "33.33%" }} />
              <div className="absolute top-0 bottom-0 border-l border-white/25" style={{ left: "66.66%" }} />
              <div className="absolute left-0 right-0 border-t border-white/25" style={{ top: "33.33%" }} />
              <div className="absolute left-0 right-0 border-t border-white/25" style={{ top: "66.66%" }} />
            </div>

            {/* Corner handles */}
            {corners.map(({ id, cx, cy }) => (
              <div
                key={id}
                className="absolute bg-white pointer-events-none"
                style={{
                  width: HANDLE_VIS,
                  height: HANDLE_VIS,
                  left: cx - HANDLE_VIS / 2,
                  top: cy - HANDLE_VIS / 2,
                  borderRadius: 2,
                  border: "2px solid rgba(0,0,0,0.35)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                }}
              />
            ))}
          </>
        )}
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleConfirm} className="gap-1.5">
          <Check className="h-3.5 w-3.5" />
          Use this preview
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} className="gap-1.5 border-border/60">
          <X className="h-3.5 w-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
