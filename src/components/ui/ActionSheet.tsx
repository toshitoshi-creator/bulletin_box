"use client";

import type { ReactNode } from "react";
import { XIcon } from "@/components/icons";

export function ActionSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 md:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-2 shadow-xl md:rounded-3xl md:p-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-1 mt-1 h-1 w-9 rounded-full bg-border md:hidden" />
        {title && (
          <div className="flex items-center justify-between px-3 py-2.5">
            <h2 className="text-sm font-semibold text-ink">{title}</h2>
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt"
            >
              <XIcon width={16} height={16} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function ActionSheetItem({
  icon,
  label,
  onClick,
  tone = "default",
}: {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm hover:bg-surface-alt ${
        tone === "danger" ? "text-danger" : "text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
