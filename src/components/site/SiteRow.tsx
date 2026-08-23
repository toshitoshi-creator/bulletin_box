"use client";

import { useState } from "react";
import Link from "next/link";
import { mutate } from "swr";
import { api, ApiRequestError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatRelative } from "@/lib/format";
import type { SiteDTO } from "@/lib/api-types";
import { AlertIcon, GlobeIcon, MoreHorizontalIcon, RefreshIcon, TrashIcon } from "@/components/icons";
import { ActionSheet, ActionSheetItem } from "@/components/ui/ActionSheet";

export function SiteRow({ site }: { site: SiteDTO }) {
  const [refreshing, setRefreshing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();

  async function refresh() {
    setRefreshing(true);
    try {
      const result = await api.sites.refresh(site.id);
      toast.show(
        result.itemCount > 0 ? `${result.itemCount}件の新しいコンテンツを取得しました` : "更新しましたが新着はありませんでした",
        result.errors.length > 0 ? "error" : "success"
      );
      mutate("/api/sites");
      mutate((key) => typeof key === "string" && key.startsWith("/api/content"), undefined, { revalidate: true });
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : "更新に失敗しました", "error");
    } finally {
      setRefreshing(false);
    }
  }

  async function remove() {
    setConfirmDelete(false);
    try {
      await api.sites.remove(site.id);
      toast.show("サイトを削除しました", "success");
      mutate("/api/sites");
      mutate((key) => typeof key === "string" && key.startsWith("/api/content"), undefined, { revalidate: true });
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : "削除に失敗しました", "error");
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
      <Link href={`/library/sites/${site.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-alt text-ink-faint">
          {site.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.iconUrl} alt="" className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          ) : (
            <GlobeIcon width={18} height={18} />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{site.name}</p>
          <p className="truncate text-xs text-ink-muted">
            {site.contentCount ?? 0}件 ・ {site.lastFetchedAt ? formatRelative(site.lastFetchedAt) : "未取得"}
          </p>
          {site.lastError && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-danger">
              <AlertIcon width={12} height={12} />
              {site.lastError}
            </p>
          )}
        </div>
      </Link>
      <button
        onClick={refresh}
        disabled={refreshing}
        aria-label="更新"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt disabled:opacity-50"
      >
        <RefreshIcon width={17} height={17} className={refreshing ? "animate-spin" : ""} />
      </button>
      <button
        onClick={() => setSheetOpen(true)}
        aria-label="サイトの操作"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt"
      >
        <MoreHorizontalIcon width={17} height={17} />
      </button>

      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={site.name}>
        <ActionSheetItem
          icon={<TrashIcon width={18} height={18} />}
          label="サイトを削除"
          tone="danger"
          onClick={() => {
            setSheetOpen(false);
            setConfirmDelete(true);
          }}
        />
      </ActionSheet>

      <ConfirmDialog
        open={confirmDelete}
        title="サイトを削除しますか？"
        description={`「${site.name}」と、取得したすべてのコンテンツが削除されます。この操作は取り消せません。`}
        confirmLabel="削除する"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
