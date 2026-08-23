"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { ContentListResponse } from "@/lib/api-types";
import { ContentFeed } from "@/components/content/ContentFeed";
import { ContentCard, type CardVariant } from "@/components/content/ContentCard";
import { ViewModeToggle } from "@/components/content/ViewModeToggle";
import { SortMenu, type SortOption } from "@/components/content/SortMenu";
import { Button } from "@/components/ui/Button";
import { useAddSiteDialog } from "@/components/site/AddSiteDialogProvider";
import { PlusIcon } from "@/components/icons";
import clsx from "clsx";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<CardVariant>("card");
  const [sort, setSort] = useState<SortOption>("new");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { open: openAddSite } = useAddSiteDialog();

  useEffect(() => {
    // localStorage isn't available during SSR, so the saved view mode can only be
    // applied after mount — this is the documented exception to "avoid setState in effects".
    const stored = localStorage.getItem("webshelf-viewmode-home");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "card" || stored === "grid" || stored === "list") setViewMode(stored);
  }, []);

  function changeViewMode(v: CardVariant) {
    setViewMode(v);
    localStorage.setItem("webshelf-viewmode-home", v);
  }

  const { data: sitesData } = useSWR<{ sites: { id: string }[] }>("/api/sites", fetcher);
  const { data: continueData } = useSWR<ContentListResponse>(
    "/api/content?sort=updated&pageSize=20",
    fetcher
  );
  const continueItems = (continueData?.items ?? []).filter((i) => i.readProgress > 0 && i.readProgress < 0.98);

  const hasSites = (sitesData?.sites.length ?? 0) > 0;

  return (
    <div className="pt-4 md:pt-6">
      <div className="flex items-center justify-between px-4 md:px-6">
        <h1 className="text-xl font-semibold text-ink">ホーム</h1>
        <Button variant="primary" size="sm" onClick={openAddSite}>
          <PlusIcon width={15} height={15} />
          サイトを追加
        </Button>
      </div>

      {continueItems.length > 0 && (
        <section className="mt-5">
          <h2 className="px-4 pb-2 text-sm font-medium text-ink-muted md:px-6">続きを読む</h2>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 md:px-6">
            {continueItems.slice(0, 8).map((item) => (
              <div key={item.id} className="w-48 shrink-0">
                <ContentCard item={item} variant="card" />
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-alt">
                  <div className="h-full bg-accent" style={{ width: `${Math.round(item.readProgress * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 px-4 md:px-6">
        <div className="flex items-center gap-1.5">
          <FilterChip active={!unreadOnly} label="すべて" onClick={() => setUnreadOnly(false)} />
          <FilterChip active={unreadOnly} label="未読" onClick={() => setUnreadOnly(true)} />
        </div>
        <div className="flex items-center gap-2">
          <SortMenu value={sort} onChange={setSort} />
          <ViewModeToggle value={viewMode} onChange={changeViewMode} />
        </div>
      </div>

      <div className="mt-4">
        {!hasSites ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-ink">まだサイトが登録されていません</p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-ink-muted">
              Webサイトを登録すると、記事や画像がここに集まります。
            </p>
            <Button variant="primary" className="mt-5" onClick={openAddSite}>
              <PlusIcon width={16} height={16} />
              最初のサイトを追加
            </Button>
          </div>
        ) : (
          <ContentFeed
            filters={{ unread: unreadOnly || undefined }}
            sort={sort}
            variant={viewMode}
            emptyTitle={unreadOnly ? "未読のコンテンツはありません" : "コンテンツがまだありません"}
            emptyDescription="サイトを更新すると新しい記事がここに表示されます。"
          />
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-accent text-white" : "bg-surface-alt text-ink-muted hover:text-ink"
      )}
    >
      {label}
    </button>
  );
}
