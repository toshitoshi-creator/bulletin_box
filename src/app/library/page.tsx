"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import clsx from "clsx";
import { fetcher } from "@/lib/api-client";
import type { SiteDTO } from "@/lib/api-types";
import { SiteRow } from "@/components/site/SiteRow";
import { ContentFeed } from "@/components/content/ContentFeed";
import { ViewModeToggle } from "@/components/content/ViewModeToggle";
import { SortMenu, type SortOption } from "@/components/content/SortMenu";
import type { CardVariant } from "@/components/content/ContentCard";
import { Button } from "@/components/ui/Button";
import { EmptyState, ListRowSkeleton } from "@/components/ui/States";
import { useAddSiteDialog } from "@/components/site/AddSiteDialogProvider";
import { GlobeIcon, PlusIcon, XIcon } from "@/components/icons";

type Tab = "sites" | "content";
type ContentFilter = "all" | "favorite" | "unread" | "saved";

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryPageInner />
    </Suspense>
  );
}

function LibraryPageInner() {
  const searchParams = useSearchParams();
  const tagParam = searchParams.get("tag");
  const [tab, setTab] = useState<Tab>(tagParam ? "content" : "sites");
  const [filter, setFilter] = useState<ContentFilter>("all");
  const [viewMode, setViewMode] = useState<CardVariant>("card");
  const [sort, setSort] = useState<SortOption>("new");
  const { open: openAddSite } = useAddSiteDialog();

  const { data: sitesData, isLoading: sitesLoading } = useSWR<{ sites: SiteDTO[] }>("/api/sites", fetcher);

  return (
    <div className="pt-4 md:pt-6">
      <div className="flex items-center justify-between px-4 md:px-6">
        <h1 className="text-xl font-semibold text-ink">ライブラリ</h1>
        <Button variant="primary" size="sm" onClick={openAddSite}>
          <PlusIcon width={15} height={15} />
          サイトを追加
        </Button>
      </div>

      <div className="mt-4 flex gap-1 border-b border-border px-4 md:px-6">
        <TabButton active={tab === "sites"} onClick={() => setTab("sites")} label="サイト" />
        <TabButton active={tab === "content"} onClick={() => setTab("content")} label="コンテンツ" />
      </div>

      {tab === "sites" ? (
        <div className="mt-2">
          {sitesLoading && (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <ListRowSkeleton key={i} />
              ))}
            </div>
          )}
          {sitesData && sitesData.sites.length === 0 && (
            <EmptyState
              icon={<GlobeIcon width={24} height={24} />}
              title="登録されたサイトがありません"
              description="URLを入力してWebサイトを登録しましょう。"
              action={
                <Button variant="primary" className="mt-2" onClick={openAddSite}>
                  サイトを追加
                </Button>
              }
            />
          )}
          {sitesData && sitesData.sites.length > 0 && (
            <div>
              {sitesData.sites.map((site) => (
                <SiteRow key={site.id} site={site} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          {tagParam && (
            <div className="mb-3 px-4 md:px-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-xs text-accent-strong">
                タグ: {tagParam}
                <a href="/library" aria-label="タグ絞り込みを解除">
                  <XIcon width={12} height={12} />
                </a>
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 md:px-6">
            <div className="flex items-center gap-1.5">
              <FilterChip active={filter === "all"} label="すべて" onClick={() => setFilter("all")} />
              <FilterChip active={filter === "unread"} label="未読" onClick={() => setFilter("unread")} />
              <FilterChip active={filter === "favorite"} label="お気に入り" onClick={() => setFilter("favorite")} />
              <FilterChip active={filter === "saved"} label="後で読む" onClick={() => setFilter("saved")} />
            </div>
            <div className="flex items-center gap-2">
              <a href="/tags" className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink">
                タグ一覧
              </a>
              <a href="/gallery" className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink">
                ギャラリー
              </a>
              <SortMenu value={sort} onChange={setSort} />
              <ViewModeToggle value={viewMode} onChange={setViewMode} />
            </div>
          </div>
          <div className="mt-4">
            <ContentFeed
              filters={{
                unread: filter === "unread" || undefined,
                favorite: filter === "favorite" || undefined,
                saved: filter === "saved" || undefined,
                tag: tagParam || undefined,
              }}
              sort={sort}
              variant={viewMode}
              emptyTitle="該当するコンテンツがありません"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"
      )}
    >
      {label}
    </button>
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
