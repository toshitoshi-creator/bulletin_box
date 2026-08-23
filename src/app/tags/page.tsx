"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { TagDTO } from "@/lib/api-types";
import { EmptyState } from "@/components/ui/States";
import { ArrowLeftIcon, TagIcon } from "@/components/icons";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function TagsPage() {
  const { data } = useSWR<{ tags: TagDTO[] }>("/api/tags", fetcher);
  const router = useRouter();

  return (
    <div className="pt-4 md:pt-6">
      <div className="px-4 md:px-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeftIcon width={16} height={16} />
          戻る
        </Button>
        <h1 className="mt-2 text-xl font-semibold text-ink">タグ</h1>
      </div>

      <div className="mt-4 px-4 md:px-6">
        {data && data.tags.length === 0 && (
          <EmptyState
            icon={<TagIcon width={24} height={24} />}
            title="タグがありません"
            description="記事の詳細画面からタグを追加できます。"
          />
        )}
        <div className="flex flex-wrap gap-2">
          {data?.tags.map((t) => (
            <Link
              key={t.id}
              href={`/library?tag=${encodeURIComponent(t.name)}`}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-ink hover:border-accent"
            >
              {t.name}
              <span className="text-xs text-ink-faint">{t.count}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
