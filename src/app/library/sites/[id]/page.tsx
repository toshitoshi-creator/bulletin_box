"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import clsx from "clsx";
import { api, fetcher, ApiRequestError } from "@/lib/api-client";
import type { SiteDTO } from "@/lib/api-types";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { ContentFeed } from "@/components/content/ContentFeed";
import { ViewModeToggle } from "@/components/content/ViewModeToggle";
import type { CardVariant } from "@/components/content/ContentCard";
import { formatRelative } from "@/lib/format";
import {
  ArrowLeftIcon,
  AlertIcon,
  ExternalLinkIcon,
  GlobeIcon,
  RefreshIcon,
  SettingsIcon,
  TrashIcon,
} from "@/components/icons";

type SubTab = "all" | "unread" | "image" | "video" | "favorite";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "unread", label: "未読" },
  { key: "image", label: "画像" },
  { key: "video", label: "動画" },
  { key: "favorite", label: "お気に入り" },
];

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, error, mutate } = useSWR<{ site: SiteDTO }>(`/api/sites/${id}`, fetcher);
  const [subTab, setSubTab] = useState<SubTab>("all");
  const [viewMode, setViewMode] = useState<CardVariant>("card");
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const result = await api.sites.refresh(id);
      toast.show(
        result.itemCount > 0 ? `${result.itemCount}件の新しいコンテンツを取得しました` : "新着はありませんでした",
        result.errors.length > 0 ? "error" : "success"
      );
      mutate();
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : "更新に失敗しました", "error");
    } finally {
      setRefreshing(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    await api.sites.remove(id);
    toast.show("サイトを削除しました", "success");
    router.push("/library");
  }

  if (error) return <ErrorState message="サイトを読み込めませんでした。" onRetry={() => mutate()} />;
  if (!data) return <LoadingState />;

  const site = data.site;

  const filters =
    subTab === "unread"
      ? { siteId: id, unread: true }
      : subTab === "favorite"
        ? { siteId: id, favorite: true }
        : subTab === "image"
          ? { siteId: id, type: "image" }
          : subTab === "video"
            ? { siteId: id, type: "video" }
            : { siteId: id };

  return (
    <div className="pt-4 md:pt-6">
      <div className="px-4 md:px-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeftIcon width={16} height={16} />
          戻る
        </Button>

        <div className="mt-3 flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-alt text-ink-faint">
            {site.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <GlobeIcon width={22} height={22} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-ink">{site.name}</h1>
            <p className="truncate text-xs text-ink-muted">{site.domain}</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {site.feedType === "rss" || site.feedType === "atom" ? "フィード取得" : "HTML解析"} ・{" "}
              {site.lastFetchedAt ? `最終更新 ${formatRelative(site.lastFetchedAt)}` : "未取得"}
            </p>
          </div>
        </div>

        {site.description && <p className="mt-3 line-clamp-2 text-sm text-ink-muted">{site.description}</p>}

        {site.lastError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-xs text-danger">
            <AlertIcon width={15} height={15} className="shrink-0" />
            {site.lastError}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshIcon width={14} height={14} className={refreshing ? "animate-spin" : ""} />
            再解析
          </Button>
          <a href={site.url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              <ExternalLinkIcon width={14} height={14} />
              サイトを開く
            </Button>
          </a>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/library/sites/${id}/rule`)}>
            <SettingsIcon width={14} height={14} />
            抽出ルールを編集
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <TrashIcon width={14} height={14} />
            削除
          </Button>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 overflow-x-auto border-b border-border px-4 md:px-6">
        <div className="flex gap-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={clsx(
                "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                subTab === t.key ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pb-2">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <div className="mt-4">
        <ContentFeed filters={filters} sort="new" variant={viewMode} emptyTitle="該当するコンテンツがありません" />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="サイトを削除しますか？"
        description={`「${site.name}」と、取得したすべてのコンテンツが削除されます。`}
        confirmLabel="削除する"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
