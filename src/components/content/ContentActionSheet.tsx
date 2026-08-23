"use client";

import { useState } from "react";
import useSWR from "swr";
import { ActionSheet, ActionSheetItem } from "@/components/ui/ActionSheet";
import { useToast } from "@/components/ui/Toast";
import { useContentActions } from "@/hooks/useContentActions";
import { api, fetcher } from "@/lib/api-client";
import type { CollectionDTO, ContentItemDTO } from "@/lib/api-types";
import {
  BookmarkIcon,
  CheckIcon,
  CollectionIcon,
  ExternalLinkIcon,
  HeartIcon,
  PlusIcon,
  ShareIcon,
} from "@/components/icons";

export function ContentActionSheet({
  item,
  open,
  onClose,
}: {
  item: ContentItemDTO;
  open: boolean;
  onClose: () => void;
}) {
  const { toggleFavorite, toggleSaved, toggleRead } = useContentActions();
  const [showCollections, setShowCollections] = useState(false);
  const toast = useToast();

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(item.url);
      toast.show("URLをコピーしました", "success");
    } catch {
      toast.show("コピーできませんでした", "error");
    }
    onClose();
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: item.title, url: item.url });
      } catch {
        // user cancelled — no-op
      }
    } else {
      await copyUrl();
      return;
    }
    onClose();
  }

  if (showCollections) {
    return (
      <CollectionPickerSheet
        item={item}
        open={open}
        onBack={() => setShowCollections(false)}
        onClose={onClose}
      />
    );
  }

  return (
    <ActionSheet open={open} onClose={onClose} title={item.title}>
      <div className="space-y-0.5">
        <ActionSheetItem
          icon={<CheckIcon width={18} height={18} />}
          label={item.isRead ? "未読にする" : "既読にする"}
          onClick={async () => {
            await toggleRead(item);
            onClose();
          }}
        />
        <ActionSheetItem
          icon={<HeartIcon width={18} height={18} filled={item.isFavorite} className={item.isFavorite ? "text-danger" : ""} />}
          label={item.isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
          onClick={async () => {
            await toggleFavorite(item);
            onClose();
          }}
        />
        <ActionSheetItem
          icon={<BookmarkIcon width={18} height={18} filled={item.isSaved} />}
          label={item.isSaved ? "保存を解除" : "後で読むに保存"}
          onClick={async () => {
            await toggleSaved(item);
            onClose();
          }}
        />
        <ActionSheetItem
          icon={<CollectionIcon width={18} height={18} />}
          label="コレクションに追加"
          onClick={() => setShowCollections(true)}
        />
        <ActionSheetItem icon={<ShareIcon width={18} height={18} />} label="共有" onClick={share} />
        <ActionSheetItem
          icon={<ExternalLinkIcon width={18} height={18} />}
          label="元サイトで開く"
          onClick={() => {
            window.open(item.url, "_blank", "noopener,noreferrer");
            onClose();
          }}
        />
        <ActionSheetItem icon={<ExternalLinkIcon width={18} height={18} />} label="URLをコピー" onClick={copyUrl} />
      </div>
    </ActionSheet>
  );
}

function CollectionPickerSheet({
  item,
  open,
  onBack,
  onClose,
}: {
  item: ContentItemDTO;
  open: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const { data, mutate: refetch } = useSWR<{ collections: CollectionDTO[] }>("/api/collections", fetcher);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set(item.collectionIds));
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const toast = useToast();

  async function toggle(collectionId: string) {
    const isMember = memberIds.has(collectionId);
    const next = new Set(memberIds);
    if (isMember) {
      next.delete(collectionId);
      await api.collections.removeItem(collectionId, item.id);
    } else {
      next.add(collectionId);
      await api.collections.addItem(collectionId, item.id);
    }
    setMemberIds(next);
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    const { collection } = await api.collections.create({ name: newName.trim() });
    await api.collections.addItem(collection.id, item.id);
    setMemberIds((prev) => new Set(prev).add(collection.id));
    setNewName("");
    setCreating(false);
    refetch();
    toast.show(`「${collection.name}」を作成しました`, "success");
  }

  return (
    <ActionSheet open={open} onClose={onClose} title="コレクションに追加">
      <div className="space-y-0.5">
        <button
          onClick={onBack}
          className="mb-1 flex items-center gap-1 px-3 py-1 text-xs text-ink-muted hover:text-ink"
        >
          ← 戻る
        </button>
        {data?.collections.length === 0 && !creating && (
          <p className="px-3 py-4 text-sm text-ink-muted">コレクションがまだありません。</p>
        )}
        {data?.collections.map((c) => {
          const active = memberIds.has(c.id);
          return (
            <ActionSheetItem
              key={c.id}
              label={c.name}
              icon={
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    active ? "border-accent bg-accent text-white" : "border-border"
                  }`}
                >
                  {active && <CheckIcon width={12} height={12} />}
                </span>
              }
              onClick={() => toggle(c.id)}
            />
          );
        })}
        {creating ? (
          <form
            className="flex items-center gap-2 px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              createAndAdd();
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="新しいコレクション名"
              className="flex-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-accent"
            />
            <button type="submit" className="text-sm font-medium text-accent">
              作成
            </button>
          </form>
        ) : (
          <ActionSheetItem
            icon={<PlusIcon width={18} height={18} />}
            label="新しいコレクションを作成"
            onClick={() => setCreating(true)}
          />
        )}
      </div>
    </ActionSheet>
  );
}
