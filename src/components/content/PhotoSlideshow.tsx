"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@/components/icons";

/** Full-screen swipeable photo viewer for an article's images, opened
 * separately from "元サイトで開く" so the user can flip through photos
 * without leaving the app. */
export function PhotoSlideshow({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: initialIndex * el.clientWidth });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onScroll() {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goTo(i: number) {
    const el = containerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goTo(index + 1);
      if (e.key === "ArrowLeft") goTo(index - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return (
    <div className="fixed inset-0 z-[125] bg-black" role="dialog" aria-modal="true" aria-label="写真スライド">
      <button
        onClick={onClose}
        aria-label="閉じる"
        className="absolute right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"
        style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
      >
        <XIcon width={20} height={20} />
      </button>

      {images.length > 1 && (
        <div
          className="absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-white"
          style={{ top: "calc(env(safe-area-inset-top) + 1.25rem)" }}
        >
          {index + 1} / {images.length}
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {images.map((src, i) => (
          <div key={src + i} className="flex h-full w-full shrink-0 snap-center items-center justify-center px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="max-h-full max-w-full select-none object-contain" draggable={false} />
          </div>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="前の写真"
            className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white disabled:opacity-30 sm:flex"
          >
            <ChevronLeftIcon width={20} height={20} />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            disabled={index === images.length - 1}
            aria-label="次の写真"
            className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white disabled:opacity-30 sm:flex"
          >
            <ChevronRightIcon width={20} height={20} />
          </button>
        </>
      )}
    </div>
  );
}
