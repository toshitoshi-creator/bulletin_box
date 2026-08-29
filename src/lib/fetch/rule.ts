import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { safeFetchText } from "./safeFetch";
import { normalizeUrl, toAbsoluteUrl, parseDateLoose, truncate, stripHtml } from "./normalize";
import type { ExtractedItem, ExtractionResult } from "./types";

/** A field selector as authored by the visual Rule Editor: a CSS selector
 * plus which part of the matched element to read. */
export interface FieldSelector {
  selector: string;
  attr: "text" | "href" | "src" | string;
}

export interface IndexRule {
  itemSelector: string;
  title: FieldSelector;
  link: FieldSelector;
  thumbnail?: FieldSelector | null;
  date?: FieldSelector | null;
  summary?: FieldSelector | null;
}

export interface DetailRule {
  title?: FieldSelector | null;
  body?: FieldSelector | null;
  thumbnail?: FieldSelector | null;
  author?: FieldSelector | null;
  date?: FieldSelector | null;
}

function readField($: CheerioAPI, $scope: ReturnType<CheerioAPI>, field: FieldSelector | null | undefined) {
  if (!field || !field.selector.trim()) return null;
  const $target = field.selector === ":self" ? $scope : $scope.find(field.selector).first();
  if ($target.length === 0) return null;
  if (field.attr === "text") {
    const text = $target.text().trim();
    return text || null;
  }
  const value = $target.attr(field.attr);
  return value?.trim() || null;
}

export class RuleApplyError extends Error {}

export interface IndexRuleResult {
  items: ExtractedItem[];
  /** How many elements itemSelector matched on the page, before any were
   * dropped below — the number a "get everything that matches" check
   * should compare items.length against. */
  scopedCount: number;
  /** Matched a scope element, but the title or link selector didn't
   * resolve within it (e.g. a promoted/sponsored card whose markup
   * differs from the regular ones the rule was built from). */
  missingFieldCount: number;
  /** Resolved to a URL another item already claimed (e.g. the link
   * selector accidentally points at a "read more"/share link shared by
   * several cards instead of each card's own permalink). */
  duplicateCount: number;
}

/** Applies a saved IndexRule to a fetched listing page's HTML, returning the
 * same ExtractedItem[] shape the automatic parsers produce, plus counts of
 * how many matched scope elements were skipped and why — so a rule that
 * only generalizes to *some* of the page's cards can be diagnosed instead
 * of silently returning fewer items than the user expects. */
export function applyIndexRule(html: string, baseUrl: string, rule: IndexRule): IndexRuleResult {
  const $ = cheerio.load(html);
  const scopes = $(rule.itemSelector).toArray();
  if (scopes.length === 0) {
    throw new RuleApplyError(`一覧の要素（${rule.itemSelector}）が見つかりませんでした。`);
  }

  const items: ExtractedItem[] = [];
  const seen = new Set<string>();
  let missingFieldCount = 0;
  let duplicateCount = 0;

  for (const el of scopes) {
    const $scope = $(el);
    const title = readField($, $scope, rule.title);
    const hrefRaw = readField($, $scope, rule.link);
    if (!title || !hrefRaw) {
      missingFieldCount++;
      continue;
    }

    const absolute = toAbsoluteUrl(hrefRaw, baseUrl);
    if (!absolute) {
      missingFieldCount++;
      continue;
    }
    const url = normalizeUrl(absolute);
    if (seen.has(url)) {
      duplicateCount++;
      continue;
    }
    seen.add(url);

    const thumbRaw = readField($, $scope, rule.thumbnail);
    const thumbnailUrl = toAbsoluteUrl(thumbRaw, baseUrl);
    const dateRaw = readField($, $scope, rule.date);
    const summaryRaw = readField($, $scope, rule.summary);

    items.push({
      title,
      url,
      thumbnailUrl,
      media: thumbnailUrl ? [thumbnailUrl] : [],
      summary: summaryRaw ? truncate(summaryRaw, 300) : null,
      publishedAt: parseDateLoose(dateRaw),
      guid: url,
      type: "article",
    });
  }

  return { items, scopedCount: scopes.length, missingFieldCount, duplicateCount };
}

/** Applies a saved DetailRule to a fetched article page's HTML. Any field
 * left unset falls back to a sane generic default (OpenGraph/heading). */
export function applyDetailRule(
  html: string,
  baseUrl: string,
  rule: DetailRule | null | undefined
): Pick<ExtractedItem, "title" | "body" | "thumbnailUrl" | "author" | "publishedAt" | "summary" | "media"> {
  const $ = cheerio.load(html);
  const $root = $.root();

  const title =
    readField($, $root, rule?.title) ||
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    "(無題)";

  const bodyField = rule?.body;
  let bodyHtml: string | null = null;
  if (bodyField && bodyField.selector.trim()) {
    const $body = $(bodyField.selector).first();
    bodyHtml = $body.length ? ($body.html() ?? null) : null;
  }

  const thumbRaw =
    readField($, $root, rule?.thumbnail) ||
    $('meta[property="og:image"]').attr("content") ||
    null;
  const thumbnailUrl = toAbsoluteUrl(thumbRaw, baseUrl);

  const author = readField($, $root, rule?.author) || $('meta[name="author"]').attr("content")?.trim() || null;
  const dateRaw = readField($, $root, rule?.date) || $("time[datetime]").first().attr("datetime") || null;
  const publishedAt = parseDateLoose(dateRaw);

  const plainText = stripHtml(bodyHtml);
  const summary =
    $('meta[property="og:description"]').attr("content")?.trim() || (plainText ? truncate(plainText, 300) : null);

  return {
    title,
    body: bodyHtml || plainText || null,
    thumbnailUrl,
    author,
    publishedAt,
    summary,
    media: thumbnailUrl ? [thumbnailUrl] : [],
  };
}

/** Fetches the list page and applies the index rule; if a detail rule is
 * also configured, fetches each item's own page too and merges in its
 * fields (partial-success: one item's detail fetch failing doesn't drop
 * it, it just keeps the index-page-only fields). */
export async function fetchWithRule(
  listUrl: string,
  index: IndexRule,
  detail: DetailRule | null | undefined
): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const { text, finalUrl } = await safeFetchText(listUrl);
  const { items, scopedCount, missingFieldCount, duplicateCount } = applyIndexRule(text, finalUrl, index);

  if (items.length === 0) {
    warnings.push("一覧ルールに一致する記事が見つかりませんでした。");
  } else if (missingFieldCount > 0 || duplicateCount > 0) {
    const reasons: string[] = [];
    if (missingFieldCount > 0) reasons.push(`タイトルまたはリンクが見つからない項目: ${missingFieldCount}件`);
    if (duplicateCount > 0) reasons.push(`リンクが他の項目と重複: ${duplicateCount}件`);
    warnings.push(
      `一覧の項目は${scopedCount}件見つかりましたが、${items.length}件のみ取得できました（${reasons.join("、")}）。一部の項目だけ形が違う可能性があります。`
    );
  }

  if (detail && Object.values(detail).some((f) => f?.selector?.trim())) {
    const MAX_DETAIL_FETCH = 20;
    for (const item of items.slice(0, MAX_DETAIL_FETCH)) {
      try {
        const page = await safeFetchText(item.url);
        const fields = applyDetailRule(page.text, page.finalUrl, detail);
        item.body = fields.body ?? item.body;
        item.thumbnailUrl = fields.thumbnailUrl ?? item.thumbnailUrl;
        item.media = fields.thumbnailUrl ? fields.media : item.media;
        item.author = fields.author ?? item.author;
        item.publishedAt = fields.publishedAt ?? item.publishedAt;
        item.summary = fields.summary ?? item.summary;
      } catch (err) {
        warnings.push(`詳細取得に失敗しました: ${item.title} (${err instanceof Error ? err.message : String(err)})`);
      }
    }
  }

  return { items, parser: "html", confidence: 0.95, warnings, errors };
}
