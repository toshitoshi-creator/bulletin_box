"use client";

import { useState } from "react";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/api-client";
import type { ContentListResponse } from "@/lib/api-types";
import { SafeImage } from "@/components/ui/SafeImage";
import { ImageLightbox } from "@/components/content/ImageLightbox";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { ArrowLeftIcon, ExternalLinkIcon, ImageIcon, LoaderIcon } from "@/components/icons";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 40;

export default function GalleryPage() {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<{ src: string; alt: string; contentId: string } | null>(null);

  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<ContentListResponse>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.hasMore) return null;
      return `/api/content?sort=new&pageSize=${PAGE_SIZE}&page=${pageIndex + 1}`;
    },
    fetcher
  );

  const items = (data ? data.flatMap((p) => p.items) : []).filter((i) => i.thumbnailUrl);
  const hasMore = data ? data[data.length - 1]?.hasMore : false;

  return (
    <div className="pt-4 md:pt-6">
      <div className="flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeftIcon width={16} height={16} />
          </Button>
          <h1 className="text-xl font-semibold text-ink">ギャラリー</h1>
        </div>
      </div>

      <div className="mt-4 px-2 md:px-4">
        {error && <ErrorState message="画像を読み込めませんでした。" onRetry={() => mutate()} />}

        {!error && data && items.length === 0 && (
          <EmptyState icon={<ImageIcon width={24} height={24} />} title="画像がまだありません" />
        )}

        {items.length > 0 && (
          <div className="columns-2 gap-2 sm:columns-3 md:columns-4 lg:columns-5 [&>*]:mb-2">
            {items.map((item) => (
              <button
                key={item.id}
                className="block w-full break-inside-avoid overflow-hidden rounded-xl bg-surface-alt"
                onClick={() =>
                  setLightbox({ src: item.thumbnailUrl as string, alt: item.title, contentId: item.id })
                }
              >
                <SafeImage src={item.thumbnailUrl} alt={item.title} className="w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center py-6">
            <Button variant="secondary" onClick={() => setSize(size + 1)} disabled={isValidating}>
              {isValidating ? <LoaderIcon width={16} height={16} /> : "もっと見る"}
            </Button>
          </div>
        )}
      </div>

      {lightbox && (
        <div>
          <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />
          <Link
            href={`/content/${lightbox.contentId}`}
            className="fixed bottom-6 left-1/2 z-[130] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-surface px-4 py-2.5 text-xs font-medium text-ink shadow-lg"
          >
            <ExternalLinkIcon width={14} height={14} />
            記事を見る
          </Link>
        </div>
      )}
    </div>
  );
}
