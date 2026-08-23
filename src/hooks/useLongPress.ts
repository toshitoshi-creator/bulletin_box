"use client";

import { useRef } from "react";

/** Fires `onLongPress` after holding a touch/mouse press for `delay` ms,
 * without blocking a normal (short) click, which still fires `onClick`. */
export function useLongPress(onLongPress: () => void, delay = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggered = useRef(false);

  function start() {
    triggered.current = false;
    timer.current = setTimeout(() => {
      triggered.current = true;
      onLongPress();
    }, delay);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
  }

  return {
    handlers: {
      onTouchStart: start,
      onTouchEnd: clear,
      onTouchMove: clear,
      onMouseDown: start,
      onMouseUp: clear,
      onMouseLeave: clear,
    },
    wasLongPress: () => triggered.current,
  };
}
