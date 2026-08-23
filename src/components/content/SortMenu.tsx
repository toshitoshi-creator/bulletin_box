"use client";

export type SortOption = "new" | "updated" | "saved" | "title";

const LABELS: Record<SortOption, string> = {
  new: "新着順",
  updated: "更新順",
  saved: "保存日時順",
  title: "タイトル順",
};

export function SortMenu({ value, onChange }: { value: SortOption; onChange: (v: SortOption) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortOption)}
      className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-accent"
      aria-label="並び順"
    >
      {Object.entries(LABELS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}
