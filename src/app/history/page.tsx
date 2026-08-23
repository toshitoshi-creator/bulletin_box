"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/api-client";
import type { HistoryEntryDTO } from "@/lib/api-types";
import { SafeImage } from "@/components/ui/SafeImage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ListRowSkeleton } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatDate, formatRelative } from "@/lib/format";
import { HistoryIcon, TrashIcon, XIcon } from "@/components/icons";

export default function HistoryPage() {
  const { data, isLoading, mutate } = useSWR<{ entries: HistoryEntryDTO[] }>("/api/history", fetcher);
  const [confirmClear, setConfirmClear] = useState(false);
  const toast = useToast();

  async function clearAll() {
    setConfirmClear(false);
    await api.history.clear();
    toast.show("履歴を削除しました", "success");
    mutate();
  }

  async function removeOne(id: string) {
    await api.history.remove(id);
    mutate();
  }

  const groups = groupByDate(data?.entries ?? []);

  return (
    <div className="pt-4 md:pt-6">
      <div className="flex items-center justify-between px-4 md:px-6">
        <h1 className="text-xl font-semibold text-ink">履歴</h1>
        {data && data.entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            <TrashIcon width={14} height={14} />
            すべて削除
          </Button>
        )}
      </div>

      <div className="mt-4">
        {isLoading && (
          <div>
            {Array.from({ length: 6 }).map((_, i) => (
              <ListRowSkeleton key={i} />
            ))}
          </div>
        )}

        {data && data.entries.length === 0 && (
          <EmptyState
            icon={<HistoryIcon width={24} height={24} />}
            title="閲覧履歴はありません"
            description="記事を開くとここに記録されます。"
          />
        )}

        {groups.map(([label, entries]) => (
          <div key={label}>
            <h2 className="px-4 pb-1 pt-4 text-xs font-medium text-ink-muted md:px-6">{label}</h2>
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-6">
                <Link href={`/content/${entry.content.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <SafeImage
                    src={entry.content.thumbnailUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    fallbackClassName="h-14 w-14 rounded-xl"
                  />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm text-ink">{entry.content.title}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {entry.content.site.name} ・ {formatRelative(entry.viewedAt)}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={() => removeOne(entry.id)}
                  aria-label="履歴から削除"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-surface-alt hover:text-ink"
                >
                  <XIcon width={15} height={15} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="履歴をすべて削除しますか？"
        description="この操作は取り消せません。"
        confirmLabel="削除する"
        danger
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

function groupByDate(entries: HistoryEntryDTO[]): [string, HistoryEntryDTO[]][] {
  const map = new Map<string, HistoryEntryDTO[]>();
  for (const entry of entries) {
    const label = formatDate(entry.viewedAt);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(entry);
  }
  return Array.from(map.entries());
}
