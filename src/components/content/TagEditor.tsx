"use client";

import { useState } from "react";
import { useContentActions } from "@/hooks/useContentActions";
import type { ContentItemDTO } from "@/lib/api-types";
import { PlusIcon, XIcon } from "@/components/icons";

export function TagEditor({ item, onChange }: { item: ContentItemDTO; onChange: () => void }) {
  const { setTags } = useContentActions();
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (!name || item.tags.includes(name)) {
      setValue("");
      setAdding(false);
      return;
    }
    await setTags(item, [...item.tags, name]);
    setValue("");
    setAdding(false);
    onChange();
  }

  async function removeTag(name: string) {
    await setTags(
      item,
      item.tags.filter((t) => t !== name)
    );
    onChange();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5">
      {item.tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-surface-alt px-2.5 py-1 text-xs text-ink-muted"
        >
          {tag}
          <button onClick={() => removeTag(tag)} aria-label={`${tag} を削除`} className="hover:text-danger">
            <XIcon width={11} height={11} />
          </button>
        </span>
      ))}
      {adding ? (
        <form onSubmit={addTag} className="inline-flex">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => !value && setAdding(false)}
            placeholder="タグ名"
            className="w-24 rounded-full border border-border bg-bg px-2.5 py-1 text-xs outline-none focus:border-accent"
          />
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-0.5 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-ink-faint hover:text-ink"
        >
          <PlusIcon width={11} height={11} />
          タグ
        </button>
      )}
    </div>
  );
}
