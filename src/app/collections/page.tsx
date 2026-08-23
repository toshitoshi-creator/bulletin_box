"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { CollectionDTO } from "@/lib/api-types";
import { CreateCollectionModal } from "@/components/collection/CreateCollectionModal";
import { Button } from "@/components/ui/Button";
import { EmptyState, CardSkeleton } from "@/components/ui/States";
import { CollectionIcon, PlusIcon } from "@/components/icons";

export default function CollectionsPage() {
  const { data, isLoading, mutate } = useSWR<{ collections: CollectionDTO[] }>("/api/collections", fetcher);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="pt-4 md:pt-6">
      <div className="flex items-center justify-between px-4 md:px-6">
        <h1 className="text-xl font-semibold text-ink">コレクション</h1>
        <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
          <PlusIcon width={15} height={15} />
          新規作成
        </Button>
      </div>

      <div className="mt-5 px-4 md:px-6">
        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {data && data.collections.length === 0 && (
          <EmptyState
            icon={<CollectionIcon width={24} height={24} />}
            title="コレクションがありません"
            description="お気に入りの記事をテーマごとにまとめておけます。"
            action={
              <Button variant="primary" className="mt-2" onClick={() => setModalOpen(true)}>
                最初のコレクションを作成
              </Button>
            }
          />
        )}

        {data && data.collections.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.collections.map((c) => (
              <Link
                key={c.id}
                href={`/collections/${c.id}`}
                className="rounded-2xl border border-border bg-surface p-4 hover:border-accent"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-alt text-xl">
                  {c.icon || "📁"}
                </div>
                <p className="line-clamp-1 text-sm font-medium text-ink">{c.name}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{c.itemCount ?? 0}件</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      <CreateCollectionModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => mutate()} />
    </div>
  );
}
