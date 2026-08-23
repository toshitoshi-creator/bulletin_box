"use client";

import { useState } from "react";
import clsx from "clsx";
import { ImageIcon } from "@/components/icons";

export function SafeImage({
  src,
  alt,
  className,
  fallbackClassName,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={clsx(
          "flex items-center justify-center bg-surface-alt text-ink-faint",
          className,
          fallbackClassName
        )}
      >
        <ImageIcon width={22} height={22} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
