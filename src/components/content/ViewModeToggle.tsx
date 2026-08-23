"use client";

import clsx from "clsx";
import { CardIcon, GridIcon, ListIcon } from "@/components/icons";
import type { CardVariant } from "./ContentCard";

const OPTIONS: { value: CardVariant; icon: typeof CardIcon; label: string }[] = [
  { value: "card", icon: CardIcon, label: "カード" },
  { value: "grid", icon: GridIcon, label: "グリッド" },
  { value: "list", icon: ListIcon, label: "リスト" },
];

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: CardVariant;
  onChange: (v: CardVariant) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-label={opt.label}
          aria-pressed={value === opt.value}
          className={clsx(
            "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
            value === opt.value ? "bg-accent text-white" : "text-ink-muted hover:text-ink"
          )}
        >
          <opt.icon width={15} height={15} />
        </button>
      ))}
    </div>
  );
}
