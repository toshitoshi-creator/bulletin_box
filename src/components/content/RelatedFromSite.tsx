"use client";

import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { ContentListResponse } from "@/lib/api-types";
import { SafeImage } from "@/components/ui/SafeImage";
import { formatDate } from "@/lib/format";

export function RelatedFromSite({ siteId, excludeId }: { siteId: string; excludeId: string }) {
  const { data } = useSWR<ContentListResponse>(
    `/api/content?siteId=${siteId}&sort=new&pageSize=7`,
    fetcher
  );
  const items = (data?.items ?? []).filter((i) => i.id !== excludeId).slice(0, 6);

  if (items.length === 0) return null;

  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="mb-3 text-sm font-medium text-ink-muted">このサイトの他の記事</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <Link key={item.id} href={`/content/${item.id}`} className="flex items-center gap-3">
            <SafeImage
              src={item.thumbnailUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-xl object-cover"
              fallbackClassName="h-14 w-14 rounded-xl"
            />
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm text-ink">{item.title}</p>
              <p className="mt-0.5 text-xs text-ink-faint">{formatDate(item.publishedAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
