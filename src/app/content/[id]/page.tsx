"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher, api } from "@/lib/api-client";
import type { ContentItemDTO, SettingsDTO } from "@/lib/api-types";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { formatDateTime } from "@/lib/format";
import { useContentActions } from "@/hooks/useContentActions";
import { SafeImage } from "@/components/ui/SafeImage";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { ContentActionSheet } from "@/components/content/ContentActionSheet";
import { ImageLightbox } from "@/components/content/ImageLightbox";
import { TagEditor } from "@/components/content/TagEditor";
import { RelatedFromSite } from "@/components/content/RelatedFromSite";
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  HeartIcon,
  MoreHorizontalIcon,
} from "@/components/icons";

export default function ContentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { data, error, mutate } = useSWR<{ item: ContentItemDTO }>(`/api/content/${id}`, fetcher, {
    revalidateOnFocus: false,
  });
  const { data: settingsData } = useSWR<{ settings: SettingsDTO }>("/api/settings", fetcher);
  const { toggleFavorite } = useContentActions();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const viewedRef = useRef(false);
  const progressRef = useRef(0);
  const savedProgressRef = useRef(0);

  const item = data?.item;

  useEffect(() => {
    if (!id || viewedRef.current) return;
    viewedRef.current = true;
    api.content.recordView(id).then(() => mutate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (item) progressRef.current = item.readProgress;
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      progressRef.current = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 1;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!item) return;
    const scrollable = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    if (item.readProgress > 0.02 && item.readProgress < 0.97 && scrollable > 0) {
      window.scrollTo({ top: item.readProgress * scrollable });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  useEffect(() => {
    if (!id) return;
    function save() {
      const p = progressRef.current;
      if (Math.abs(p - savedProgressRef.current) > 0.01) {
        savedProgressRef.current = p;
        api.content.update(id, { readProgress: p }).catch(() => {});
      }
    }
    const interval = setInterval(save, 5000);
    document.addEventListener("visibilitychange", save);
    window.addEventListener("pagehide", save);
    return () => {
      save();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", save);
      window.removeEventListener("pagehide", save);
    };
  }, [id]);

  const sanitizedBody = useMemo(() => (item?.body ? sanitizeArticleHtml(item.body) : null), [item]);
  const fontSize = settingsData?.settings.fontSize ?? 17;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <BackBar onBack={() => router.back()} />
        <ErrorState message="コンテンツを読み込めませんでした。" onRetry={() => mutate()} />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <BackBar onBack={() => router.back()} />
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <div
        className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/95 px-3 py-2.5 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
      >
        <button
          onClick={() => router.back()}
          aria-label="戻る"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-surface-alt"
        >
          <ArrowLeftIcon width={20} height={20} />
        </button>
        <p className="line-clamp-1 flex-1 px-2 text-center text-xs text-ink-muted">{item.site.name}</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleFavorite(item).then(() => mutate())}
            aria-label={item.isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-surface-alt"
          >
            <HeartIcon width={19} height={19} filled={item.isFavorite} className={item.isFavorite ? "text-danger" : ""} />
          </button>
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="その他の操作"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-surface-alt"
          >
            <MoreHorizontalIcon width={19} height={19} />
          </button>
        </div>
      </div>

      <article className="px-5 pt-5">
        {item.thumbnailUrl && (
          <button className="block w-full" onClick={() => setLightboxSrc(item.thumbnailUrl)}>
            <SafeImage
              src={item.thumbnailUrl}
              alt=""
              className="mb-5 aspect-[16/9] w-full rounded-2xl object-cover"
              fallbackClassName="mb-5 aspect-[16/9] w-full rounded-2xl"
            />
          </button>
        )}

        <h1 className="text-xl font-semibold leading-snug text-ink md:text-2xl">{item.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          {item.author && <span>{item.author}</span>}
          {item.author && item.publishedAt && <span aria-hidden>·</span>}
          {item.publishedAt && <span>{formatDateTime(item.publishedAt)}</span>}
        </div>

        <TagEditor item={item} onChange={() => mutate()} />

        <div className="mt-6">
          {sanitizedBody ? (
            <div
              className="reader-body text-ink"
              style={{ fontSize: `${fontSize}px` }}
              dangerouslySetInnerHTML={{ __html: sanitizedBody }}
            />
          ) : (
            <div className="rounded-2xl border border-border bg-surface-alt p-5 text-center">
              <p className="text-sm text-ink-muted">
                {item.summary || "本文を取得できませんでした。元サイトでご覧ください。"}
              </p>
            </div>
          )}
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 flex items-center justify-center gap-2 rounded-full border border-border py-3 text-sm font-medium text-ink hover:bg-surface-alt"
        >
          <ExternalLinkIcon width={16} height={16} />
          元サイトで開く
        </a>

        <RelatedFromSite siteId={item.site.id} excludeId={item.id} />
      </article>

      <ContentActionSheet item={item} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      {lightboxSrc && <ImageLightbox src={lightboxSrc} alt={item.title} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
      <ArrowLeftIcon width={16} height={16} />
      戻る
    </Button>
  );
}
