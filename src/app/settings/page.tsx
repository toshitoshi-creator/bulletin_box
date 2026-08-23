"use client";

import { useRef, useState } from "react";
import useSWR, { mutate } from "swr";
import { api, fetcher, ApiRequestError } from "@/lib/api-client";
import type { SettingsDTO, ThemePref } from "@/lib/api-types";
import { applyTheme } from "@/lib/theme";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { CardIcon, GridIcon, ListIcon, MoonIcon, SettingsIcon, SunIcon, TrashIcon } from "@/components/icons";
import clsx from "clsx";
import type { CardVariant } from "@/components/content/ContentCard";

const THEME_OPTIONS: { value: ThemePref; label: string; icon: typeof SunIcon }[] = [
  { value: "system", label: "システム", icon: SettingsIcon },
  { value: "light", label: "ライト", icon: SunIcon },
  { value: "dark", label: "ダーク", icon: MoonIcon },
];

const VIEW_OPTIONS: { value: CardVariant; label: string; icon: typeof CardIcon }[] = [
  { value: "card", label: "カード", icon: CardIcon },
  { value: "grid", label: "グリッド", icon: GridIcon },
  { value: "list", label: "リスト", icon: ListIcon },
];

export default function SettingsPage() {
  const { data, mutate: mutateSettings } = useSWR<{ settings: SettingsDTO }>("/api/settings", fetcher);
  const toast = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const settings = data?.settings;

  async function updateTheme(theme: ThemePref) {
    applyTheme(theme);
    await api.settings.update({ theme });
    mutateSettings();
  }

  async function updateFontSize(fontSize: number) {
    mutateSettings((prev) => (prev ? { settings: { ...prev.settings, fontSize } } : prev), { revalidate: false });
    await api.settings.update({ fontSize });
  }

  async function updateDefaultViewMode(defaultViewMode: CardVariant) {
    await api.settings.update({ defaultViewMode });
    mutateSettings();
  }

  async function clearAll() {
    setConfirmClear(false);
    setBusy(true);
    try {
      await api.data.clearAll();
      toast.show("すべてのデータを削除しました", "success");
      mutate(() => true, undefined, { revalidate: true });
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : "削除に失敗しました", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const result = await api.data.importFile(file);
      toast.show(
        `${result.sitesImported}サイト・${result.itemsImported}件のコンテンツを取り込みました`,
        "success"
      );
      mutate(() => true, undefined, { revalidate: true });
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : "インポートに失敗しました", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pt-4 pb-10 md:pt-6">
      <div className="px-4 md:px-6">
        <h1 className="text-xl font-semibold text-ink">設定</h1>
      </div>

      <SettingsSection title="表示">
        <SettingsRow label="テーマ">
          <div className="flex gap-1.5">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateTheme(opt.value)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
                  settings?.theme === opt.value
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-border text-ink-muted"
                )}
              >
                <opt.icon width={14} height={14} />
                {opt.label}
              </button>
            ))}
          </div>
        </SettingsRow>

        <SettingsRow label="文字サイズ" description={`${settings?.fontSize ?? 17}px`}>
          <input
            type="range"
            min={13}
            max={24}
            step={1}
            value={settings?.fontSize ?? 17}
            onChange={(e) => updateFontSize(Number(e.target.value))}
            className="w-36 accent-[var(--accent)]"
          />
        </SettingsRow>

        <SettingsRow label="デフォルト表示形式">
          <div className="flex gap-1.5">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateDefaultViewMode(opt.value)}
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full border",
                  settings?.defaultViewMode === opt.value
                    ? "border-accent bg-accent-soft text-accent-strong"
                    : "border-border text-ink-muted"
                )}
              >
                <opt.icon width={14} height={14} />
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="データ管理" description="すべてのデータはこの端末上に保存されています。">
        <SettingsRow label="データをエクスポート" description="サイト・記事・コレクションをJSONファイルとして保存します。">
          <a href="/api/data/export">
            <Button variant="secondary" size="sm">
              書き出す
            </Button>
          </a>
        </SettingsRow>

        <SettingsRow label="データをインポート" description="以前エクスポートしたJSONファイルを読み込みます。">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            ファイルを選択
          </Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </SettingsRow>

        <SettingsRow label="すべてのデータを削除" description="サイト・記事・コレクション・履歴・設定を完全に削除します。">
          <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)} disabled={busy}>
            <TrashIcon width={14} height={14} />
            削除する
          </Button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="このアプリについて">
        <p className="px-4 pb-4 text-sm text-ink-muted md:px-6">
          WEB SHELF は、登録したWebサイトのコンテンツを構造化して読みやすく表示するローカルファーストなリーダーです。
          データは外部に送信されず、この端末上に保存されます。
        </p>
      </SettingsSection>

      <ConfirmDialog
        open={confirmClear}
        title="すべてのデータを削除しますか？"
        description="サイト・記事・コレクション・履歴が完全に削除されます。この操作は取り消せません。"
        confirmLabel="完全に削除する"
        danger
        onConfirm={clearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="px-4 pb-1 text-xs font-medium uppercase tracking-wide text-ink-faint md:px-6">{title}</h2>
      {description && <p className="px-4 pb-2 text-xs text-ink-muted md:px-6">{description}</p>}
      <div className="divide-y divide-border border-y border-border">{children}</div>
    </section>
  );
}

function SettingsRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 md:px-6">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
