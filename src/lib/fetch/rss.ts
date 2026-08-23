import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { safeFetchText } from "./safeFetch";
import { normalizeUrl, toAbsoluteUrl, parseDateLoose, stripHtml, truncate } from "./normalize";
import type { ExtractionResult, ExtractedItem } from "./types";

type CustomFeed = Record<string, unknown>;
type CustomItem = {
  "content:encoded"?: string;
  "dc:creator"?: string;
  creator?: string;
  enclosure?: { url?: string; type?: string };
  mediaContent?: { $: { url?: string } } | { $: { url?: string } }[];
  mediaThumbnail?: { $: { url?: string } };
};

const parser = new Parser<CustomFeed, CustomItem>({
  timeout: 15000,
  headers: { "User-Agent": "WebShelfBot/1.0 (+content reader)" },
  customFields: {
    item: [
      ["content:encoded", "content:encoded"],
      ["dc:creator", "dc:creator"],
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
    ],
  },
});

function firstImageFromHtml(html: string | undefined, base: string): string | null {
  if (!html) return null;
  const $ = cheerio.load(html);
  const src = $("img").first().attr("src");
  return toAbsoluteUrl(src, base);
}

export async function fetchAndParseRss(feedUrl: string): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const { text, finalUrl } = await safeFetchText(feedUrl, {
    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9,*/*;q=0.5",
  });

  let feed: Awaited<ReturnType<typeof parser.parseString>>;
  try {
    feed = await parser.parseString(text);
  } catch (err) {
    throw new Error(
      `フィードを解析できませんでした: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const items: ExtractedItem[] = [];

  for (const raw of feed.items ?? []) {
    const link = raw.link ? normalizeUrl(raw.link, finalUrl) : null;
    if (!link || !raw.title) {
      warnings.push(`タイトルまたはリンクが欠落しているためスキップしました: ${raw.title ?? link ?? "(unknown)"}`);
      continue;
    }

    const bodyHtml = raw["content:encoded"] || raw.content || raw.contentSnippet || "";
    const summary = raw.contentSnippet || truncate(stripHtml(bodyHtml), 300);

    let thumbnail: string | null = null;
    if (raw.enclosure?.url && (raw.enclosure.type ?? "").startsWith("image")) {
      thumbnail = toAbsoluteUrl(raw.enclosure.url, finalUrl);
    }
    if (!thumbnail && raw.mediaThumbnail) {
      thumbnail = toAbsoluteUrl(raw.mediaThumbnail.$?.url, finalUrl);
    }
    if (!thumbnail && raw.mediaContent) {
      const mc = Array.isArray(raw.mediaContent) ? raw.mediaContent[0] : raw.mediaContent;
      thumbnail = toAbsoluteUrl(mc?.$?.url, finalUrl);
    }
    if (!thumbnail) {
      thumbnail = firstImageFromHtml(bodyHtml, finalUrl);
    }

    const publishedAt = parseDateLoose(raw.isoDate || raw.pubDate);
    const author = raw.creator || raw["dc:creator"] || null;

    items.push({
      title: raw.title.trim(),
      url: link,
      summary: summary || null,
      body: bodyHtml || null,
      thumbnailUrl: thumbnail,
      author: author ? String(author).trim() : null,
      publishedAt,
      guid: raw.guid || link,
      type: thumbnail && !bodyHtml ? "image" : "article",
    });
  }

  if (items.length === 0) {
    warnings.push("フィードにアイテムが見つかりませんでした。");
  }

  return {
    items,
    parser: "rss",
    confidence: 0.99,
    warnings,
    errors,
  };
}
