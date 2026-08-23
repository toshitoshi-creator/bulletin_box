"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { SafeImage } from "@/components/ui/SafeImage";
import { ContentActionSheet } from "./ContentActionSheet";
import { useContentActions } from "@/hooks/useContentActions";
import { useLongPress } from "@/hooks/useLongPress";
import { formatDate } from "@/lib/format";
import type { ContentItemDTO } from "@/lib/api-types";
import { HeartIcon } from "@/components/icons";

export type CardVariant = "card" | "grid" | "list";

export function ContentCard({ item, variant }: { item: ContentItemDTO; variant: CardVariant }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { toggleFavorite } = useContentActions();
  const longPress = useLongPress(() => setSheetOpen(true));

  const href = `/content/${item.id}`;

  function onClick(e: React.MouseEvent) {
    if (longPress.wasLongPress()) e.preventDefault();
  }

  const meta = (
    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span className="truncate">{item.site.name}</span>
      {item.publishedAt && (
        <>
          <span aria-hidden>·</span>
          <span className="shrink-0">{formatDate(item.publishedAt)}</span>
        </>
      )}
    </div>
  );

  if (variant === "list") {
    return (
      <>
        <Link
          href={href}
          onClick={onClick}
          {...longPress.handlers}
          className="flex items-start gap-3 border-b border-border px-4 py-3.5 active:bg-surface-alt"
        >
          <SafeImage
            src={item.thumbnailUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl object-cover"
            fallbackClassName="h-16 w-16 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              {!item.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="未読" />}
              <p className={clsx("line-clamp-2 text-sm", item.isRead ? "text-ink-muted" : "font-medium text-ink")}>
                {item.title}
              </p>
            </div>
            {meta}
          </div>
          <QuickFavorite item={item} onToggle={toggleFavorite} />
        </Link>
        <ContentActionSheet item={item} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </>
    );
  }

  if (variant === "grid") {
    return (
      <>
        <Link
          href={href}
          onClick={onClick}
          {...longPress.handlers}
          className="group block overflow-hidden rounded-2xl border border-border bg-surface active:opacity-90"
        >
          <div className="relative">
            <SafeImage src={item.thumbnailUrl} alt="" className="aspect-square w-full object-cover" fallbackClassName="aspect-square w-full" />
            {!item.isRead && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent shadow" />}
          </div>
          <div className="p-2.5">
            <p className={clsx("line-clamp-2 text-xs leading-snug", item.isRead ? "text-ink-muted" : "font-medium text-ink")}>
              {item.title}
            </p>
          </div>
        </Link>
        <ContentActionSheet item={item} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Link
        href={href}
        onClick={onClick}
        {...longPress.handlers}
        className="block overflow-hidden rounded-2xl border border-border bg-surface transition-shadow active:opacity-95"
      >
        <SafeImage
          src={item.thumbnailUrl}
          alt=""
          className="aspect-[16/9] w-full object-cover"
          fallbackClassName="aspect-[16/9] w-full"
        />
        <div className="space-y-1.5 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              {!item.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-label="未読" />}
              <p className={clsx("line-clamp-2 text-sm", item.isRead ? "text-ink-muted" : "font-medium text-ink")}>
                {item.title}
              </p>
            </div>
            <QuickFavorite item={item} onToggle={toggleFavorite} />
          </div>
          {meta}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {item.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded-full bg-surface-alt px-2 py-0.5 text-[11px] text-ink-muted">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
      <ContentActionSheet item={item} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

function QuickFavorite({
  item,
  onToggle,
}: {
  item: ContentItemDTO;
  onToggle: (item: ContentItemDTO) => Promise<void>;
}) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(item);
      }}
      aria-label={item.isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
      className="shrink-0 rounded-full p-1 text-ink-faint hover:text-danger"
    >
      <HeartIcon width={17} height={17} filled={item.isFavorite} className={item.isFavorite ? "text-danger" : ""} />
    </button>
  );
}
