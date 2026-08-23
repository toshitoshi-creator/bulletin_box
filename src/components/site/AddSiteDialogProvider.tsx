"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { mutate } from "swr";
import { api, ApiRequestError } from "@/lib/api-client";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { SafeImage } from "@/components/ui/SafeImage";
import { CheckIcon, LoaderIcon, RefreshIcon, XIcon } from "@/components/icons";

type Step = "input" | "discovering" | "preview" | "registering" | "done" | "error";

interface Preview {
  url: string;
  domain: string;
  name: string;
  iconUrl: string | null;
  description: string | null;
  feedUrl: string | null;
  feedType: string;
}

interface AddSiteDialogContextValue {
  open: () => void;
}

const AddSiteDialogContext = createContext<AddSiteDialogContextValue | null>(null);

export function useAddSiteDialog() {
  const ctx = useContext(AddSiteDialogContext);
  if (!ctx) throw new Error("useAddSiteDialog must be used within AddSiteDialogProvider");
  return ctx;
}

export function AddSiteDialogProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [resultCount, setResultCount] = useState(0);
  const toast = useToast();

  const reset = useCallback(() => {
    setStep("input");
    setUrl("");
    setPreview(null);
    setErrorMessage("");
    setResultCount(0);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(reset, 200);
  }, [reset]);

  const openDialog = useCallback(() => {
    reset();
    setVisible(true);
  }, [reset]);

  async function handleDiscover(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setStep("discovering");
    try {
      const result = await api.sites.discover(url.trim());
      setPreview(result);
      setStep("preview");
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "サイトを解析できませんでした。");
      setStep("error");
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setStep("registering");
    try {
      const result = await api.sites.register(preview.url);
      setResultCount(result.itemCount);
      setStep("done");
      mutate("/api/sites");
      mutate((key) => typeof key === "string" && key.startsWith("/api/content"), undefined, { revalidate: true });
      toast.show(`「${result.site.name}」を追加しました`, "success");
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.message : "サイトの登録に失敗しました。");
      setStep("error");
    }
  }

  return (
    <AddSiteDialogContext.Provider value={{ open: openDialog }}>
      {children}
      {visible && (
        <div
          className="fixed inset-0 z-[105] flex items-end justify-center bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-surface p-5 shadow-xl md:rounded-3xl"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">サイトを登録</h2>
              <button
                onClick={close}
                aria-label="閉じる"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt"
              >
                <XIcon width={18} height={18} />
              </button>
            </div>

            {step === "input" && (
              <form onSubmit={handleDiscover} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-ink-muted">WebサイトのURL</label>
                  <input
                    autoFocus
                    type="text"
                    inputMode="url"
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent"
                  />
                  <p className="mt-2 text-xs text-ink-muted">
                    RSS/Atomフィードやページ構造を自動で解析し、記事を取得します。
                  </p>
                </div>
                <Button type="submit" variant="primary" className="w-full" disabled={!url.trim()}>
                  解析する
                </Button>
              </form>
            )}

            {step === "discovering" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <LoaderIcon width={28} height={28} className="text-accent" />
                <p className="text-sm text-ink-muted">サイトを解析しています…</p>
              </div>
            )}

            {step === "preview" && preview && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-2xl border border-border p-3.5">
                  <SafeImage
                    src={preview.iconUrl}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                    fallbackClassName="h-11 w-11 rounded-full"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{preview.name}</p>
                    <p className="truncate text-xs text-ink-muted">{preview.domain}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-xs text-accent-strong">
                  <CheckIcon width={16} height={16} className="shrink-0" />
                  {preview.feedUrl
                    ? `${preview.feedType.toUpperCase()} フィードを検出しました`
                    : "フィードは見つかりませんでした。ページ構造から記事を解析します"}
                </div>

                {preview.description && <p className="line-clamp-3 text-sm text-ink-muted">{preview.description}</p>}

                <div className="flex gap-2">
                  <Button variant="ghost" className="flex-1" onClick={() => setStep("input")}>
                    戻る
                  </Button>
                  <Button variant="primary" className="flex-1" onClick={handleConfirm}>
                    このサイトを追加
                  </Button>
                </div>
              </div>
            )}

            {step === "registering" && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <LoaderIcon width={28} height={28} className="text-accent" />
                <p className="text-sm text-ink-muted">コンテンツを取得しています…</p>
              </div>
            )}

            {step === "done" && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                  <CheckIcon width={26} height={26} />
                </div>
                <p className="text-sm font-medium text-ink">
                  {resultCount > 0 ? `${resultCount}件の記事を取得しました` : "サイトを登録しました"}
                </p>
                {resultCount === 0 && (
                  <p className="max-w-xs text-xs text-ink-muted">
                    現時点で記事は取得できませんでした。ライブラリから再解析できます。
                  </p>
                )}
                <Button variant="primary" className="w-full" onClick={close}>
                  閉じる
                </Button>
              </div>
            )}

            {step === "error" && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm font-medium text-danger">{errorMessage}</p>
                <div className="flex w-full gap-2">
                  <Button variant="ghost" className="flex-1" onClick={close}>
                    閉じる
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setStep("input")}>
                    <RefreshIcon width={16} height={16} />
                    やり直す
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AddSiteDialogContext.Provider>
  );
}
