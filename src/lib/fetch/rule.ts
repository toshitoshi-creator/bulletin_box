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

/** Applies a saved IndexRule to a fetched listing page's HTML, returning the
 * same ExtractedItem[] shape the automatic parsers produce. */
export function applyIndexRule(html: string, baseUrl: string, rule: IndexRule): ExtractedItem[] {
  const $ = cheerio.load(html);
  const scopes = $(rule.itemSelector).toArray();
  if (scopes.length === 0) {
    throw new RuleApplyError(`一覧の要素（${rule.itemSelector}）が見つかりませんでした。`);
  }

  const items: ExtractedItem[] = [];
  const seen = new Set<string>();

  for (const el of scopes) {
    const $scope = $(el);
    const title = readField($, $scope, rule.title);
    const hrefRaw = readField($, $scope, rule.link);
    if (!title || !hrefRaw) continue;

    const absolute = toAbsoluteUrl(hrefRaw, baseUrl);
    if (!absolute) continue;
    const url = normalizeUrl(absolute);
    if (seen.has(url)) continue;
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

  return items;
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
  const items = applyIndexRule(text, finalUrl, index);

  if (items.length === 0) {
    warnings.push("一覧ルールに一致する記事が見つかりませんでした。");
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
