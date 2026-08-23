"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api-client";
import type { ContentListResponse } from "@/lib/api-types";
import { ContentGrid, ContentGridSkeleton } from "@/components/content/ContentGrid";
import { EmptyState } from "@/components/ui/States";
import { SearchIcon, XIcon } from "@/components/icons";

const RECENT_KEY = "webshelf-recent-searches";

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  const trimmed = query.trim();
  if (!trimmed) return;
  const next = [trimmed, ...loadRecent().filter((q) => q !== trimmed)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export default function SearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // localStorage isn't available during SSR, so recent searches can only be read after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(loadRecent());
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(input.trim());
      if (input.trim()) saveRecent(input.trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  const { data, isLoading } = useSWR<ContentListResponse>(
    query ? `/api/content?q=${encodeURIComponent(query)}&pageSize=40&sort=new` : null,
    fetcher
  );

  return (
    <div className="pt-4 md:pt-6">
      <div className="px-4 md:px-6">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5">
          <SearchIcon width={18} height={18} className="text-ink-faint" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="タイトル・本文・サイト名・タグで検索"
            className="flex-1 bg-transparent text-sm text-ink outline-none"
          />
          {input && (
            <button onClick={() => setInput("")} aria-label="クリア" className="text-ink-faint hover:text-ink">
              <XIcon width={16} height={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-5">
        {!query && (
          <div className="px-4 md:px-6">
            {recent.length > 0 ? (
              <>
                <h2 className="mb-2 text-xs font-medium text-ink-muted">最近の検索</h2>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => setInput(r)}
                      className="rounded-full bg-surface-alt px-3 py-1.5 text-xs text-ink-muted hover:text-ink"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                icon={<SearchIcon width={24} height={24} />}
                title="キーワードを入力してください"
                description="タイトル・本文・サイト名・作者・タグから検索できます。"
              />
            )}
          </div>
        )}

        {query && isLoading && <ContentGridSkeleton variant="list" />}

        {query && data && data.items.length === 0 && (
          <EmptyState
            icon={<SearchIcon width={24} height={24} />}
            title="該当するコンテンツが見つかりませんでした"
            description={`「${query}」に一致する結果はありません。`}
          />
        )}

        {query && data && data.items.length > 0 && (
          <>
            <p className="px-4 pb-2 text-xs text-ink-muted md:px-6">{data.total}件見つかりました</p>
            <ContentGrid items={data.items} variant="list" />
          </>
        )}
      </div>
    </div>
  );
}
