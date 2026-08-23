"use client";

import { useRef, useState } from "react";
import { XIcon } from "@/components/icons";

export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const lastTap = useRef(0);

  function handleClick(e: React.MouseEvent<HTMLImageElement>) {
    const now = Date.now();
    const isDoubleTap = now - lastTap.current < 320;
    lastTap.current = now;
    if (isDoubleTap) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setOrigin(`${x}% ${y}%`);
      setZoomed((z) => !z);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <XIcon width={20} height={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => {
          e.stopPropagation();
          handleClick(e);
        }}
        className="max-h-full max-w-full cursor-zoom-in select-none object-contain transition-transform duration-200"
        style={{ transform: zoomed ? "scale(2.2)" : "scale(1)", transformOrigin: origin }}
        draggable={false}
      />
    </div>
  );
}
