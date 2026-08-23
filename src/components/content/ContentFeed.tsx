"use client";

import { useEffect, type ReactNode } from "react";
import useSWRInfinite from "swr/infinite";
import { fetcher } from "@/lib/api-client";
import type { ContentListResponse } from "@/lib/api-types";
import type { CardVariant } from "./ContentCard";
import { ContentGrid, ContentGridSkeleton } from "./ContentGrid";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { Button } from "@/components/ui/Button";
import { InboxIcon, LoaderIcon } from "@/components/icons";

const PAGE_SIZE = 24;

export function ContentFeed({
  filters,
  sort,
  variant,
  emptyTitle = "コンテンツがありません",
  emptyDescription,
  emptyAction,
}: {
  filters: Record<string, string | number | boolean | undefined>;
  sort: string;
  variant: CardVariant;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  const filterKey = JSON.stringify({ filters, sort });

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite<ContentListResponse>(
    (pageIndex, previousPageData) => {
      if (previousPageData && !previousPageData.hasMore) return null;
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== "") params.set(k, String(v));
      });
      params.set("sort", sort);
      params.set("page", String(pageIndex + 1));
      params.set("pageSize", String(PAGE_SIZE));
      return `/api/content?${params.toString()}`;
    },
    fetcher,
    { revalidateFirstPage: true }
  );

  useEffect(() => {
    setSize(1);
  }, [filterKey, setSize]);

  const items = data ? data.flatMap((page) => page.items) : [];
  const hasMore = data ? data[data.length - 1]?.hasMore : false;
  const initialLoading = isLoading && !data;

  if (initialLoading) {
    return <ContentGridSkeleton variant={variant} />;
  }

  if (error) {
    return <ErrorState message="コンテンツを読み込めませんでした。" onRetry={() => mutate()} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<InboxIcon width={26} height={26} />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <PullToRefresh onRefresh={() => mutate()}>
      <ContentGrid items={items} variant={variant} />
      <div className="flex justify-center py-6">
        {hasMore ? (
          <Button variant="secondary" onClick={() => setSize(size + 1)} disabled={isValidating}>
            {isValidating ? <LoaderIcon width={16} height={16} /> : "もっと見る"}
          </Button>
        ) : (
          <p className="text-xs text-ink-faint">すべて表示しました</p>
        )}
      </div>
    </PullToRefresh>
  );
}
