"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import clsx from "clsx";
import { api, fetcher, ApiRequestError } from "@/lib/api-client";
import type { SiteDTO } from "@/lib/api-types";
import type { DetailRule, FieldSelector, IndexRule, PreviewIndexItem } from "@/lib/rule-editor/types";
import { computeSelector, computeRelativeSelector, describeElement, matchCount } from "@/lib/rule-editor/selector";
import { PickerFrame } from "@/components/rule-editor/PickerFrame";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { LoadingState, ErrorState } from "@/components/ui/States";
import { ArrowLeftIcon, CheckIcon, AlertIcon, RefreshIcon } from "@/components/icons";

type Step =
  | "list-url"
  | "pick-item"
  | "pick-index-fields"
  | "pick-next-page"
  | "index-preview"
  | "detail-choice"
  | "detail-url"
  | "pick-detail-fields"
  | "detail-preview";

type Attr = "text" | "href" | "src";

interface IndexFieldDef {
  key: "title" | "link" | "thumbnail" | "date" | "summary";
  label: string;
  required: boolean;
  hint: string;
}

interface DetailFieldDef {
  key: "title" | "body" | "thumbnail" | "author" | "date";
  label: string;
  required: boolean;
  hint: string;
}

const INDEX_FIELDS: IndexFieldDef[] = [
  { key: "title", label: "タイトル", required: true, hint: "記事のタイトル部分をタップしてください" },
  { key: "link", label: "リンク", required: true, hint: "記事へのリンク（通常は記事全体かタイトル）をタップしてください" },
  { key: "thumbnail", label: "サムネイル画像", required: false, hint: "サムネイル画像をタップしてください（任意）" },
  { key: "date", label: "日付", required: false, hint: "日付が表示されている部分をタップしてください（任意）" },
  { key: "summary", label: "概要文", required: false, hint: "概要・抜粋の部分をタップしてください（任意）" },
];

const DETAIL_FIELDS: DetailFieldDef[] = [
  { key: "title", label: "タイトル", required: false, hint: "記事タイトルをタップしてください（任意・省略時は自動判定）" },
  { key: "body", label: "本文", required: false, hint: "本文が入っている枠（囲み全体）をタップしてください" },
  { key: "thumbnail", label: "サムネイル画像", required: false, hint: "見出し画像をタップしてください（任意）" },
  { key: "author", label: "著者", required: false, hint: "著者名の部分をタップしてください（任意）" },
  { key: "date", label: "日付", required: false, hint: "日付の部分をタップしてください（任意）" },
];

function defaultAttr(fieldKey: string, el: Element): Attr {
  if (fieldKey === "link" || fieldKey === "nextPage") return "href";
  if (fieldKey === "thumbnail") return "src";
  if (el.tagName === "IMG") return "src";
  return "text";
}

/** A tap rarely lands on the exact <a>/<img> that carries the attribute a
 * field needs (e.g. tapping the title text nested inside the card's link).
 * For the link/thumbnail/nextPage fields, walk to the nearest element that
 * actually has the attribute, staying within `scope` so the result is
 * still usable as a selector relative to it (`scope` is null for
 * page-level picks like nextPage, which aren't relative to anything). */
function resolvePickTarget(fieldKey: string, el: Element, scope: Element | null): Element {
  const within = (candidate: Element | null) =>
    candidate !== null && (!scope || candidate === scope || scope.contains(candidate));

  if (fieldKey === "link" || fieldKey === "nextPage") {
    if (el.hasAttribute("href")) return el;
    const anchor = el.closest("a[href]");
    if (within(anchor)) return anchor as Element;
  }
  if (fieldKey === "thumbnail") {
    if (el.tagName === "IMG" && el.hasAttribute("src")) return el;
    const descendant = el.querySelector("img[src]");
    if (within(descendant)) return descendant as Element;
    const ancestor = el.closest("img[src]");
    if (within(ancestor)) return ancestor as Element;
  }
  return el;
}

function fieldPreviewValue(el: Element, attr: Attr): string {
  if (attr === "text") return el.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) ?? "";
  if (attr === "href") return el.getAttribute("href") ?? "";
  if (attr === "src") return el.getAttribute("src") ?? "";
  return "";
}

export default function RuleEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data, error, mutate } = useSWR<{ site: SiteDTO }>(`/api/sites/${id}`, fetcher);

  const [step, setStep] = useState<Step>("list-url");
  const [listUrlInput, setListUrlInput] = useState("");
  const [renderSrc, setRenderSrc] = useState<string | null>(null);
  const [frameDoc, setFrameDoc] = useState<Document | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const [itemSelector, setItemSelector] = useState("");
  const [itemCount, setItemCount] = useState(0);
  const scopeElRef = useRef<Element | null>(null);

  const [indexFields, setIndexFields] = useState<Partial<Record<IndexFieldDef["key"], FieldSelector>>>({});
  const [indexFieldStep, setIndexFieldStep] = useState(0);
  const [nextPageField, setNextPageField] = useState<FieldSelector | null>(null);
  const [pendingPick, setPendingPick] = useState<{ el: Element; attr: Attr } | null>(null);

  const [previewItems, setPreviewItems] = useState<PreviewIndexItem[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSkipped, setPreviewSkipped] = useState<{
    scopedCount: number;
    missingFieldCount: number;
    duplicateCount: number;
  } | null>(null);
  const [previewPages, setPreviewPages] = useState<number | null>(null);

  const [detailUrlInput, setDetailUrlInput] = useState("");
  const [detailFields, setDetailFields] = useState<Partial<Record<DetailFieldDef["key"], FieldSelector>>>({});
  const [detailFieldStep, setDetailFieldStep] = useState(0);
  const detailScopeElRef = useRef<Element | null>(null);

  const [detailPreview, setDetailPreview] = useState<{
    title: string;
    body: string | null;
    thumbnailUrl: string | null;
    author: string | null;
    publishedAt: string | null;
  } | null>(null);
  const [detailPreviewError, setDetailPreviewError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    (async () => {
      try {
        const res = await api.rule.get(id);
        setListUrlInput(res.rule.listUrl);
        setItemSelector(res.rule.index.itemSelector);
        setIndexFields({
          title: res.rule.index.title,
          link: res.rule.index.link,
          thumbnail: res.rule.index.thumbnail ?? undefined,
          date: res.rule.index.date ?? undefined,
          summary: res.rule.index.summary ?? undefined,
        });
        setNextPageField(res.rule.index.nextPage ?? null);
        if (res.rule.detail) {
          setDetailFields({
            title: res.rule.detail.title ?? undefined,
            body: res.rule.detail.body ?? undefined,
            thumbnail: res.rule.detail.thumbnail ?? undefined,
            author: res.rule.detail.author ?? undefined,
            date: res.rule.detail.date ?? undefined,
          });
        }
      } catch {
        // No existing rule yet; start fresh from the site's own URL.
        setListUrlInput((prev) => prev || data.site.url);
      } finally {
        setLoadingExisting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const currentIndexField = INDEX_FIELDS[indexFieldStep];
  const currentDetailField = DETAIL_FIELDS[detailFieldStep];

  const loadListPage = useCallback(() => {
    const url = listUrlInput.trim();
    if (!url) return;
    setFrameDoc(null);
    setItemSelector("");
    setItemCount(0);
    scopeElRef.current = null;
    setIndexFields({});
    setIndexFieldStep(0);
    setNextPageField(null);
    setPendingPick(null);
    setRenderSrc(`/api/rules/render?url=${encodeURIComponent(url)}`);
    setStep("pick-item");
  }, [listUrlInput]);

  const handleFrameLoad = useCallback((doc: Document) => {
    setFrameDoc(doc);
  }, []);

  function handleItemPick(el: Element) {
    const doc = el.ownerDocument;
    const selector = computeSelector(el, doc.body);
    // computeSelector aims for uniqueness; for a repeating card we want the
    // broadest class-based form of that same element, which naturally
    // matches all its siblings sharing the same markup.
    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList);
    const broad = classes.length > 0 ? `${tag}.${classes.map((c) => CSS.escape(c)).join(".")}` : selector;
    const count = matchCount(doc.body, broad);
    const chosen = count >= 2 ? broad : selector;
    setItemSelector(chosen);
    setItemCount(matchCount(doc.body, chosen));
    scopeElRef.current = el;
  }

  function widenItemSelection() {
    const el = scopeElRef.current;
    if (!el || !el.parentElement || !frameDoc) return;
    const parent = el.parentElement;
    if (parent === frameDoc.body) return;
    handleItemPick(parent);
  }

  function confirmItemSelection() {
    if (!itemSelector || itemCount < 1) {
      toast.show("一覧の項目が見つかりません。別の要素をタップしてください。", "error");
      return;
    }
    if (!scopeElRef.current) return;
    setStep("pick-index-fields");
  }

  function handleIndexFieldPick(rawEl: Element) {
    const el = resolvePickTarget(currentIndexField.key, rawEl, scopeElRef.current);
    setPendingPick({ el, attr: defaultAttr(currentIndexField.key, el) });
  }

  /** A tap almost always lands on the innermost leaf under the cursor (a
   * paragraph, a text run) rather than the wrapping container the user
   * actually meant (e.g. "the whole excerpt block"). Lets them step the
   * pending pick up to its parent instead of having to re-tap blindly. */
  function widenPendingPick(fieldKey: string, scope: Element | null) {
    setPendingPick((prev) => {
      if (!prev) return prev;
      if (scope && prev.el === scope) return prev;
      const parent = prev.el.parentElement;
      if (!parent) return prev;
      return { el: parent, attr: defaultAttr(fieldKey, parent) };
    });
  }

  function confirmIndexField() {
    if (!pendingPick || !scopeElRef.current) return;
    const relSelector = computeRelativeSelector(pendingPick.el, scopeElRef.current);
    const updated = { ...indexFields, [currentIndexField.key]: { selector: relSelector, attr: pendingPick.attr } };
    setIndexFields(updated);
    setPendingPick(null);
    advanceIndexField();
  }

  function skipIndexField() {
    setPendingPick(null);
    advanceIndexField();
  }

  function advanceIndexField() {
    if (indexFieldStep < INDEX_FIELDS.length - 1) {
      setIndexFieldStep((s) => s + 1);
    } else {
      // The next-page step reads `indexFields` itself once the user acts on
      // it, by which point the setIndexFields() from the last field confirm
      // has already committed — no stale-closure risk here.
      setStep("pick-next-page");
    }
  }

  function handleNextPagePick(rawEl: Element) {
    const el = resolvePickTarget("nextPage", rawEl, null);
    setPendingPick({ el, attr: defaultAttr("nextPage", el) });
  }

  function confirmNextPage() {
    if (!pendingPick || !frameDoc) return;
    const selector = computeSelector(pendingPick.el, frameDoc.body);
    const field: FieldSelector = { selector, attr: pendingPick.attr };
    setNextPageField(field);
    setPendingPick(null);
    runIndexPreview(indexFields, field);
  }

  function skipNextPage() {
    setPendingPick(null);
    setNextPageField(null);
    runIndexPreview(indexFields, null);
  }

  function buildIndexRule(
    fields: Partial<Record<IndexFieldDef["key"], FieldSelector>> = indexFields,
    nextPage: FieldSelector | null = nextPageField
  ): IndexRule | null {
    const title = fields.title;
    const link = fields.link;
    if (!title || !link) return null;
    return {
      itemSelector,
      title,
      link,
      thumbnail: fields.thumbnail ?? null,
      date: fields.date ?? null,
      summary: fields.summary ?? null,
      nextPage: nextPage ?? null,
    };
  }

  async function runIndexPreview(
    fields: Partial<Record<IndexFieldDef["key"], FieldSelector>> = indexFields,
    nextPage: FieldSelector | null = nextPageField
  ) {
    const rule = buildIndexRule(fields, nextPage);
    if (!rule) {
      toast.show("タイトルとリンクは必須です。", "error");
      return;
    }
    setStep("index-preview");
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewItems(null);
    setPreviewSkipped(null);
    setPreviewPages(null);
    try {
      const res = await api.rulePreview.index(listUrlInput.trim(), rule);
      if (res.error) {
        setPreviewError(res.error);
      } else {
        setPreviewItems(res.items);
        setPreviewPages(res.pagesFetched);
        if (res.missingFieldCount > 0 || res.duplicateCount > 0) {
          setPreviewSkipped({
            scopedCount: res.scopedCount,
            missingFieldCount: res.missingFieldCount,
            duplicateCount: res.duplicateCount,
          });
        }
      }
    } catch (err) {
      setPreviewError(err instanceof ApiRequestError ? err.message : "プレビューに失敗しました。");
    } finally {
      setPreviewLoading(false);
    }
  }

  function goToDetailChoice() {
    setStep("detail-choice");
  }

  function skipDetailAndSave() {
    saveRule(null);
  }

  function startDetailSetup() {
    const example = previewItems?.[0]?.url;
    setDetailUrlInput(example || "");
    setStep("detail-url");
  }

  function loadDetailPage() {
    const url = detailUrlInput.trim();
    if (!url) return;
    setFrameDoc(null);
    setDetailFields({});
    setDetailFieldStep(0);
    setPendingPick(null);
    detailScopeElRef.current = null;
    setRenderSrc(`/api/rules/render?url=${encodeURIComponent(url)}`);
    setStep("pick-detail-fields");
  }

  function handleDetailFrameLoad(doc: Document) {
    setFrameDoc(doc);
    detailScopeElRef.current = doc.body;
  }

  function handleDetailFieldPick(rawEl: Element) {
    const el = resolvePickTarget(currentDetailField.key, rawEl, detailScopeElRef.current);
    setPendingPick({ el, attr: defaultAttr(currentDetailField.key, el) });
  }

  function confirmDetailField() {
    if (!pendingPick || !frameDoc) return;
    const relSelector = computeSelector(pendingPick.el, frameDoc.body);
    const updated = { ...detailFields, [currentDetailField.key]: { selector: relSelector, attr: pendingPick.attr } };
    setDetailFields(updated);
    setPendingPick(null);
    advanceDetailField(updated);
  }

  function skipDetailField() {
    setPendingPick(null);
    advanceDetailField(detailFields);
  }

  // See advanceIndexField: takes the just-updated map explicitly to avoid
  // reading stale pre-update state when this fires after the last field.
  function advanceDetailField(fields: Partial<Record<DetailFieldDef["key"], FieldSelector>>) {
    if (detailFieldStep < DETAIL_FIELDS.length - 1) {
      setDetailFieldStep((s) => s + 1);
    } else {
      runDetailPreview(fields);
    }
  }

  function buildDetailRule(
    fields: Partial<Record<DetailFieldDef["key"], FieldSelector>> = detailFields
  ): DetailRule | null {
    if (Object.keys(fields).length === 0) return null;
    return {
      title: fields.title ?? null,
      body: fields.body ?? null,
      thumbnail: fields.thumbnail ?? null,
      author: fields.author ?? null,
      date: fields.date ?? null,
    };
  }

  async function runDetailPreview(fields: Partial<Record<DetailFieldDef["key"], FieldSelector>> = detailFields) {
    const rule = buildDetailRule(fields);
    setStep("detail-preview");
    setDetailPreviewError(null);
    setDetailPreview(null);
    try {
      const res = await api.rulePreview.detail(detailUrlInput.trim(), rule ?? {});
      setDetailPreview(res.fields);
    } catch (err) {
      setDetailPreviewError(err instanceof ApiRequestError ? err.message : "プレビューに失敗しました。");
    }
  }

  async function saveRule(detail: DetailRule | null) {
    const index = buildIndexRule();
    if (!index) {
      toast.show("タイトルとリンクは必須です。", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await api.rule.save(id, { listUrl: listUrlInput.trim(), index, detail });
      const base = res.itemCount > 0 ? `ルールを保存しました（${res.itemCount}件取得）` : "ルールを保存しました";
      const message = res.warnings.length > 0 ? `${base}。${res.warnings[0]}` : base;
      toast.show(message, res.errors.length > 0 || res.warnings.length > 0 ? "error" : "success");
      mutate();
      router.push(`/library/sites/${id}`);
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : "保存に失敗しました。", "error");
    } finally {
      setSaving(false);
    }
  }

  async function removeRule() {
    setSaving(true);
    try {
      await api.rule.remove(id);
      toast.show("カスタムルールを削除しました（自動解析に戻ります）", "success");
      mutate();
      router.push(`/library/sites/${id}`);
    } catch (err) {
      toast.show(err instanceof ApiRequestError ? err.message : "削除に失敗しました。", "error");
    } finally {
      setSaving(false);
    }
  }

  const stepIndex = useMemo(() => {
    const order: Step[] = [
      "list-url",
      "pick-item",
      "pick-index-fields",
      "pick-next-page",
      "index-preview",
      "detail-choice",
      "detail-url",
      "pick-detail-fields",
      "detail-preview",
    ];
    return order.indexOf(step);
  }, [step]);

  if (error) return <ErrorState message="サイトを読み込めませんでした。" onRetry={() => mutate()} />;
  if (!data || loadingExisting) return <LoadingState label="読み込み中…" />;

  const site = data.site;

  return (
    <div className="flex h-[100dvh] flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/library/sites/${id}`)}>
          <ArrowLeftIcon width={16} height={16} />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">抽出ルール編集 — {site.name}</p>
          <p className="text-xs text-ink-faint">ステップ {Math.max(stepIndex, 0) + 1} / 9</p>
        </div>
        {itemSelector && step !== "list-url" && (
          <Button variant="ghost" size="sm" onClick={removeRule} disabled={saving}>
            ルール削除
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="shrink-0 overflow-y-auto border-b border-border p-4 md:w-80 md:border-b-0 md:border-r">
          {step === "list-url" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">一覧ページのURL</p>
              <p className="text-xs text-ink-muted">
                記事の一覧が表示されているページのURLを入力してください。読み込んだページ上で、実際にタップして項目を選びます。
              </p>
              <input
                type="text"
                value={listUrlInput}
                onChange={(e) => setListUrlInput(e.target.value)}
                placeholder="https://example.com/news"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
              <Button variant="primary" onClick={loadListPage} disabled={!listUrlInput.trim()}>
                ページを読み込む
              </Button>
            </div>
          )}

          {step === "pick-item" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">① 一覧の1項目をタップ</p>
              <p className="text-xs text-ink-muted">
                記事カード（1件分の枠）をタップしてください。同じ形の項目がすべて緑色でハイライトされます。
              </p>
              {itemSelector ? (
                <div className="rounded-xl bg-accent-soft px-3 py-2.5 text-xs text-accent-strong">
                  <p className="font-medium">{itemCount} 件が一致しました</p>
                  <p className="mt-1 break-all font-mono text-[11px] opacity-80">{itemSelector}</p>
                </div>
              ) : (
                <div className="rounded-xl bg-surface-alt px-3 py-2.5 text-xs text-ink-muted">
                  まだ何も選択されていません
                </div>
              )}
              {itemSelector && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={widenItemSelection}>
                    範囲を広げる（親要素）
                  </Button>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setStep("list-url")}>
                  戻る
                </Button>
                <Button
                  variant="primary"
                  onClick={confirmItemSelection}
                  disabled={!itemSelector || itemCount < 1}
                >
                  この選択で次へ
                </Button>
              </div>
            </div>
          )}

          {step === "pick-index-fields" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">
                ② {currentIndexField.label}
                {currentIndexField.required && <span className="ml-1 text-danger">*必須</span>}
              </p>
              <p className="text-xs text-ink-muted">{currentIndexField.hint}</p>
              <p className="text-xs text-ink-faint">
                緑の枠（選んだ1項目）の中でタップしてください。{indexFieldStep + 1} / {INDEX_FIELDS.length}
              </p>

              {pendingPick && (
                <PendingPickCard
                  pick={pendingPick}
                  onAttrChange={(attr) => setPendingPick({ ...pendingPick, attr })}
                  onWiden={() => widenPendingPick(currentIndexField.key, scopeElRef.current)}
                />
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {pendingPick ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setPendingPick(null)}>
                      選び直す
                    </Button>
                    <Button variant="primary" size="sm" onClick={confirmIndexField}>
                      決定して次へ
                    </Button>
                  </>
                ) : (
                  !currentIndexField.required && (
                    <Button variant="secondary" size="sm" onClick={skipIndexField}>
                      スキップ
                    </Button>
                  )
                )}
              </div>

              <div className="mt-3 space-y-1 border-t border-border pt-3">
                {INDEX_FIELDS.map((f, i) => (
                  <div
                    key={f.key}
                    className={clsx(
                      "flex items-center justify-between rounded-lg px-2 py-1 text-xs",
                      i === indexFieldStep ? "bg-accent-soft text-accent-strong" : "text-ink-faint"
                    )}
                  >
                    <span>{f.label}</span>
                    {indexFields[f.key] && <CheckIcon width={13} height={13} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "pick-next-page" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">③ 次のページへのリンク（任意）</p>
              <p className="text-xs text-ink-muted">
                一覧に「次へ」や「2」のようなページ送りのリンクがあれば、それをタップしてください。複数ページにまたがる記事も自動でまとめて取得します。ない場合はスキップしてください。
              </p>

              {pendingPick && (
                <PendingPickCard
                  pick={pendingPick}
                  onAttrChange={(attr) => setPendingPick({ ...pendingPick, attr })}
                  onWiden={() => widenPendingPick("nextPage", null)}
                />
              )}

              {!pendingPick && nextPageField && (
                <div className="rounded-xl bg-accent-soft px-3 py-2.5 text-xs text-accent-strong">
                  <p className="font-medium">設定済み</p>
                  <p className="mt-1 break-all font-mono text-[11px] opacity-80">{nextPageField.selector}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {pendingPick ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setPendingPick(null)}>
                      選び直す
                    </Button>
                    <Button variant="primary" size="sm" onClick={confirmNextPage}>
                      決定してプレビューへ
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={skipNextPage}>
                    {nextPageField ? "設定を外してプレビューへ" : "スキップ（ページ送りなし）"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {step === "index-preview" && (
            <IndexPreviewPanel
              loading={previewLoading}
              error={previewError}
              items={previewItems}
              skipped={previewSkipped}
              pagesFetched={previewPages}
              onRetry={() => runIndexPreview()}
              onBack={() => {
                setIndexFieldStep(0);
                setStep("pick-index-fields");
              }}
              onNext={goToDetailChoice}
            />
          )}

          {step === "detail-choice" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">記事の詳細ページも設定しますか？</p>
              <p className="text-xs text-ink-muted">
                本文や著者名など、記事を開いたときの表示も自分で選べます。省略すると自動判定になります。
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <Button variant="primary" onClick={startDetailSetup}>
                  詳細ページも設定する
                </Button>
                <Button variant="secondary" onClick={skipDetailAndSave} disabled={saving}>
                  一覧の設定だけで保存する
                </Button>
              </div>
            </div>
          )}

          {step === "detail-url" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">記事詳細ページのURL</p>
              <p className="text-xs text-ink-muted">一覧から拾った記事URLの例です。必要なら書き換えてください。</p>
              <input
                type="text"
                value={detailUrlInput}
                onChange={(e) => setDetailUrlInput(e.target.value)}
                placeholder="https://example.com/news/123"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setStep("detail-choice")}>
                  戻る
                </Button>
                <Button variant="primary" onClick={loadDetailPage} disabled={!detailUrlInput.trim()}>
                  ページを読み込む
                </Button>
              </div>
            </div>
          )}

          {step === "pick-detail-fields" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">④ {currentDetailField.label}</p>
              <p className="text-xs text-ink-muted">{currentDetailField.hint}</p>
              <p className="text-xs text-ink-faint">
                {detailFieldStep + 1} / {DETAIL_FIELDS.length}
              </p>

              {pendingPick && (
                <PendingPickCard
                  pick={pendingPick}
                  onAttrChange={(attr) => setPendingPick({ ...pendingPick, attr })}
                  onWiden={() => widenPendingPick(currentDetailField.key, detailScopeElRef.current)}
                />
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {pendingPick ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setPendingPick(null)}>
                      選び直す
                    </Button>
                    <Button variant="primary" size="sm" onClick={confirmDetailField}>
                      決定して次へ
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={skipDetailField}>
                    スキップ
                  </Button>
                )}
              </div>

              <div className="mt-3 space-y-1 border-t border-border pt-3">
                {DETAIL_FIELDS.map((f, i) => (
                  <div
                    key={f.key}
                    className={clsx(
                      "flex items-center justify-between rounded-lg px-2 py-1 text-xs",
                      i === detailFieldStep ? "bg-accent-soft text-accent-strong" : "text-ink-faint"
                    )}
                  >
                    <span>{f.label}</span>
                    {detailFields[f.key] && <CheckIcon width={13} height={13} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "detail-preview" && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-ink">詳細ページのプレビュー</p>
              {detailPreviewError && (
                <div className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-xs text-danger">
                  <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
                  {detailPreviewError}
                </div>
              )}
              {detailPreview && (
                <div className="space-y-2 rounded-xl border border-border bg-surface p-3 text-xs">
                  <p className="font-medium text-ink">{detailPreview.title}</p>
                  {detailPreview.author && <p className="text-ink-muted">著者: {detailPreview.author}</p>}
                  {detailPreview.publishedAt && <p className="text-ink-muted">日付: {detailPreview.publishedAt}</p>}
                  {detailPreview.body && (
                    <p className="line-clamp-4 text-ink-faint">
                      {detailPreview.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200)}
                    </p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setStep("pick-detail-fields")}>
                  やり直す
                </Button>
                <Button
                  variant="primary"
                  onClick={() => saveRule(buildDetailRule())}
                  disabled={saving}
                >
                  この内容で保存
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="min-h-[45vh] flex-1 bg-surface-alt md:min-h-0">
          {renderSrc ? (
            <PickerFrame
              src={renderSrc}
              enabled={
                step === "pick-item" ||
                step === "pick-index-fields" ||
                step === "pick-next-page" ||
                step === "pick-detail-fields"
              }
              scopeEl={
                step === "pick-index-fields"
                  ? scopeElRef.current
                  : step === "pick-detail-fields"
                    ? detailScopeElRef.current
                    : null
              }
              persistentSelector={step === "pick-item" ? itemSelector : null}
              onFrameLoad={step === "pick-detail-fields" ? handleDetailFrameLoad : handleFrameLoad}
              onPick={
                step === "pick-item"
                  ? handleItemPick
                  : step === "pick-index-fields"
                    ? handleIndexFieldPick
                    : step === "pick-next-page"
                      ? handleNextPagePick
                      : step === "pick-detail-fields"
                        ? handleDetailFieldPick
                        : undefined
              }
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-faint">
              URLを入力してページを読み込むと、ここにプレビューが表示されます。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingPickCard({
  pick,
  onAttrChange,
  onWiden,
}: {
  pick: { el: Element; attr: Attr };
  onAttrChange: (attr: Attr) => void;
  onWiden: () => void;
}) {
  const desc = describeElement(pick.el);
  const value = fieldPreviewValue(pick.el, pick.attr);
  return (
    <div className="space-y-2 rounded-xl border border-accent bg-accent-soft p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-accent-strong">
          &lt;{desc.tag}{desc.className ? ` class="${desc.className}"` : ""}&gt;
        </p>
        <button onClick={onWiden} className="shrink-0 whitespace-nowrap text-[11px] font-medium text-accent-strong underline">
          上の要素を選択
        </button>
      </div>
      <div className="flex gap-1.5">
        {(["text", "href", "src"] as Attr[]).map((a) => (
          <button
            key={a}
            onClick={() => onAttrChange(a)}
            className={clsx(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              pick.attr === a ? "bg-accent text-white" : "bg-surface text-ink-muted hover:text-ink"
            )}
          >
            {a === "text" ? "テキスト" : a === "href" ? "リンクURL" : "画像URL"}
          </button>
        ))}
      </div>
      <p className="break-all text-ink-muted">値: {value || "(空)"}</p>
    </div>
  );
}

function IndexPreviewPanel({
  loading,
  error,
  items,
  skipped,
  pagesFetched,
  onRetry,
  onBack,
  onNext,
}: {
  loading: boolean;
  error: string | null;
  items: PreviewIndexItem[] | null;
  skipped: { scopedCount: number; missingFieldCount: number; duplicateCount: number } | null;
  pagesFetched: number | null;
  onRetry: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-ink">一覧の抽出プレビュー</p>
      {loading && (
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <RefreshIcon width={14} height={14} className="animate-spin" />
          取得中…
        </p>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-xs text-danger">
          <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {items && skipped && (
        <div className="flex items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-xs text-danger">
          <AlertIcon width={14} height={14} className="mt-0.5 shrink-0" />
          <div>
            <p>
              一覧の項目は{skipped.scopedCount}件ありましたが、{items.length}件しか取得できませんでした。
            </p>
            <p className="mt-0.5">
              {skipped.missingFieldCount > 0 &&
                `タイトルまたはリンクが見つからない項目: ${skipped.missingFieldCount}件　`}
              {skipped.duplicateCount > 0 && `リンクが重複している項目: ${skipped.duplicateCount}件`}
            </p>
            <p className="mt-0.5">
              一部のカードだけ形が違う可能性があります。「戻る」からタイトル/リンクの選び方を見直してください。
            </p>
          </div>
        </div>
      )}
      {items && (
        <>
          <p className="text-xs text-ink-muted">
            {items.length} 件を取得しました
            {pagesFetched !== null && pagesFetched > 1 && `（${pagesFetched}ページ分。プレビューは最大3ページまで）`}
          </p>
          <div className="max-h-[40vh] space-y-2 overflow-y-auto md:max-h-none">
            {items.slice(0, 10).map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-2 text-xs">
                <p className="line-clamp-2 font-medium text-ink">{item.title}</p>
                {item.publishedAt && <p className="mt-0.5 text-ink-faint">{item.publishedAt}</p>}
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onBack}>
          戻る
        </Button>
        <Button variant="secondary" size="sm" onClick={onRetry} disabled={loading}>
          再取得
        </Button>
        <Button variant="primary" size="sm" onClick={onNext} disabled={loading || !items || items.length === 0}>
          次へ
        </Button>
      </div>
    </div>
  );
}
