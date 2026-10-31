"use client";

import { useId } from "react";

const PNG_SIZE = 1024;
const PNG_MARGIN = 64;

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  // Revoke after the click is handled — revoking synchronously can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

// PNG/SVG download for a rendered <QRCode id={qrId} />. `title` names the file.
export function useQrDownload(title: string) {
  const qrId = `qr-${useId().replace(/:/g, "")}`;
  const fileBase = `qr-${title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "nandzz"}`;

  const serializeQR = () => {
    const svg = document.getElementById(qrId);
    return svg ? new XMLSerializer().serializeToString(svg) : null;
  };

  const downloadSvg = () => {
    const svgStr = serializeQR();
    if (!svgStr) return;
    const href = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml" }));
    triggerDownload(href, `${fileBase}.svg`);
  };

  const downloadPng = () => {
    const svgStr = serializeQR();
    if (!svgStr) return;
    const svgUrl = URL.createObjectURL(new Blob([svgStr], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // White quiet zone so the code scans on any background it's placed on.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, PNG_MARGIN, PNG_MARGIN, PNG_SIZE - PNG_MARGIN * 2, PNG_SIZE - PNG_MARGIN * 2);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const href = URL.createObjectURL(blob);
          triggerDownload(href, `${fileBase}.png`);
        }, "image/png");
      }
      URL.revokeObjectURL(svgUrl);
    };
    img.src = svgUrl;
  };

  return { qrId, downloadPng, downloadSvg };
}
