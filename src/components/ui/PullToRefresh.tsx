"use client";

import { useRef, useState } from "react";
import { LoaderIcon } from "@/components/icons";

const THRESHOLD = 64;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<unknown>;
  children: React.ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    startY.current = window.scrollY <= 0 && !refreshing ? e.touches[0].clientY : null;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) setPull(Math.min(delta * 0.5, 96));
  }

  async function onTouchEnd() {
    if (pull > THRESHOLD) {
      setRefreshing(true);
      setPull(52);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
    startY.current = null;
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: pull }}
        aria-hidden={pull === 0}
      >
        <LoaderIcon width={20} height={20} className={refreshing ? "text-accent" : "text-ink-faint"} />
      </div>
      {children}
    </div>
  );
}
