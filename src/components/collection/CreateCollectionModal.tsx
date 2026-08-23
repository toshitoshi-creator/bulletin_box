"use client";

import { useState } from "react";
import { api, ApiRequestError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { XIcon } from "@/components/icons";

const ICONS = ["📚", "📰", "🎨", "💡", "🍳", "🎮", "🧳", "💼", "🏃", "🎬"];

export function CreateCollectionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(ICONS[0]);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.collections.create({ name: name.trim(), description: description.trim() || null, icon });
      toast.show(`「${name.trim()}」を作成しました`, "success");
      setName("");
      setDescription("");
      onCreated();
      onClose();
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : "作成に失敗しました", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-xl md:rounded-3xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">新しいコレクション</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt"
          >
            <XIcon width={18} height={18} />
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {ICONS.map((i) => (
            <button
              type="button"
              key={i}
              onClick={() => setIcon(i)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-lg ${
                icon === i ? "bg-accent-soft ring-2 ring-accent" : "bg-surface-alt"
              }`}
            >
              {i}
            </button>
          ))}
        </div>

        <label className="mb-1.5 block text-xs font-medium text-ink-muted">名前</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="例: あとで読む"
          className="mb-3 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />

        <label className="mb-1.5 block text-xs font-medium text-ink-muted">説明（任意）</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-5 w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm outline-none focus:border-accent"
        />

        <Button type="submit" variant="primary" className="w-full" disabled={!name.trim() || submitting}>
          作成する
        </Button>
      </form>
    </div>
  );
}
