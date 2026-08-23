"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api-client";
import type { CollectionDetailDTO } from "@/lib/api-types";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { ContentGrid } from "@/components/content/ContentGrid";
import { ViewModeToggle } from "@/components/content/ViewModeToggle";
import type { CardVariant } from "@/components/content/ContentCard";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeftIcon, CollectionIcon, TrashIcon } from "@/components/icons";

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, error, mutate } = useSWR<{ collection: CollectionDetailDTO }>(`/api/collections/${id}`, fetcher);
  const [viewMode, setViewMode] = useState<CardVariant>("list");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");

  async function remove() {
    setConfirmDelete(false);
    await api.collections.remove(id);
    toast.show("コレクションを削除しました", "success");
    router.push("/collections");
  }

  async function saveName() {
    if (!name.trim()) return;
    await api.collections.update(id, { name: name.trim() });
    setEditing(false);
    mutate();
  }

  if (error) return <ErrorState message="コレクションを読み込めませんでした。" onRetry={() => mutate()} />;
  if (!data) return <LoadingState />;

  const collection = data.collection;

  return (
    <div className="pt-4 md:pt-6">
      <div className="px-4 md:px-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeftIcon width={16} height={16} />
          戻る
        </Button>

        <div className="mt-3 flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-alt text-2xl">
            {collection.icon || "📁"}
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveName();
                }}
                className="flex gap-2"
              >
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                />
                <button type="submit" className="text-sm font-medium text-accent">
                  保存
                </button>
              </form>
            ) : (
              <h1
                className="truncate text-lg font-semibold text-ink"
                onClick={() => {
                  setName(collection.name);
                  setEditing(true);
                }}
              >
                {collection.name}
              </h1>
            )}
            <p className="mt-0.5 text-xs text-ink-muted">{collection.items.length}件</p>
          </div>
        </div>

        {collection.description && <p className="mt-3 text-sm text-ink-muted">{collection.description}</p>}

        <div className="mt-4 flex items-center justify-between">
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <TrashIcon width={14} height={14} />
            コレクションを削除
          </Button>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <div className="mt-4">
        {collection.items.length === 0 ? (
          <EmptyState
            icon={<CollectionIcon width={24} height={24} />}
            title="このコレクションにはまだ何もありません"
            description="記事の「その他の操作」からコレクションに追加できます。"
          />
        ) : (
          <ContentGrid items={collection.items} variant={viewMode} />
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="コレクションを削除しますか？"
        description="コレクション自体が削除されます（記事本体は削除されません）。"
        confirmLabel="削除する"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
