import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { safeFetchText } from "./safeFetch";
import { mapWithConcurrency } from "./concurrency";
import { normalizeUrl, toAbsoluteUrl, parseDateLoose, stripHtml, truncate } from "./normalize";
import type { ExtractionResult, ExtractedItem } from "./types";

const REMOVE_SELECTORS = [
  "script",
  "style",
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "iframe",
  "noscript",
  '[class*="advert" i]',
  '[class*="banner" i]',
  '[id*="advert" i]',
  '[class*="sidebar" i]',
  '[id*="sidebar" i]',
  '[class*="widget" i]',
  '[class*="related" i]',
  '[class*="recommend" i]',
  '[class*="promo" i]',
  '[class*="sponsor" i]',
  '[class*="newsletter" i]',
  '[class*="subscribe" i]',
  '[class*="social" i]',
  '[class*="share" i]',
  '[class*="comment" i]',
  '[class*="popup" i]',
  '[class*="modal" i]',
  '[class*="cookie" i]',
  '[class*="slider" i]',
  '[class*="slideshow" i]',
  '[class*="carousel" i]',
  '[class*="swiper" i]',
  '[class*="slick" i]',
  '[class*="splide" i]',
  '[id*="slider" i]',
  '[id*="carousel" i]',
  '[class*="header" i]',
  '[id*="header" i]',
  '[class*="breadcrumb" i]',
];

/** Returns a clone of the document with nav/sidebar/ad/widget noise stripped,
 * so neither the article body nor the listing-page link scan pick it up. */
function stripNoise($: CheerioAPI) {
  const $clean = $.root().clone();
  REMOVE_SELECTORS.forEach((sel) => $clean.find(sel).remove());
  return $clean;
}

interface JsonLdArticle {
  headline?: string;
  name?: string;
  description?: string;
  image?: string | string[] | { url?: string };
  author?: { name?: string } | { name?: string }[] | string;
  datePublished?: string;
  dateModified?: string;
  articleBody?: string;
}

function extractJsonLd($: CheerioAPI): JsonLdArticle | null {
  const candidates: JsonLdArticle[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] ?? [parsed];
      for (const node of nodes) {
        const type = node?.["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (types.some((t) => typeof t === "string" && /Article|BlogPosting|NewsArticle/i.test(t))) {
          candidates.push(node);
        }
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  });
  return candidates[0] ?? null;
}

function jsonLdImage(image: JsonLdArticle["image"]): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return typeof image[0] === "string" ? image[0] : null;
  if (typeof image === "object") return image.url ?? null;
  return null;
}

function jsonLdAuthor(author: JsonLdArticle["author"]): string | null {
  if (!author) return null;
  if (typeof author === "string") return author;
  if (Array.isArray(author)) return author[0]?.name ?? null;
  return author.name ?? null;
}

interface ArticleExtraction {
  title: string;
  body: string;
  summary: string;
  thumbnailUrl: string | null;
  media: string[];
  author: string | null;
  publishedAt: Date | null;
}

function imagesFromContainer($: CheerioAPI, container: ReturnType<CheerioAPI>, pageUrl: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  container.find("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || $(el).attr("data-original");
    const abs = toAbsoluteUrl(src, pageUrl);
    if (abs && !seen.has(abs)) {
      seen.add(abs);
      urls.push(abs);
    }
  });
  return urls;
}

/** Extracts a single article's fields from an already-loaded page, preferring
 * JSON-LD, then OpenGraph/meta tags, then a DOM heuristic (article/main text density). */
export function extractArticle($: CheerioAPI, pageUrl: string): ArticleExtraction {
  const jsonLd = extractJsonLd($);

  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const title =
    jsonLd?.headline?.trim() ||
    jsonLd?.name?.trim() ||
    ogTitle ||
    $("h1").first().text().trim() ||
    $("title").first().text().trim() ||
    "(無題)";

  const ogImage = $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content");
  const thumbnailUrl = toAbsoluteUrl(jsonLdImage(jsonLd?.image) || ogImage, pageUrl);

  const author =
    jsonLdAuthor(jsonLd?.author) ||
    $('meta[name="author"]').attr("content")?.trim() ||
    $('[rel="author"]').first().text().trim() ||
    null;

  const publishedAt = parseDateLoose(
    jsonLd?.datePublished ||
      $('meta[property="article:published_time"]').attr("content") ||
      $("time[datetime]").first().attr("datetime")
  );

  const $body = stripNoise($);

  const container = $body.find("article").first().length
    ? $body.find("article").first()
    : $body.find("main").first().length
      ? $body.find("main").first()
      : $body.find("body");

  let bodyHtml = "";
  if (jsonLd?.articleBody) {
    bodyHtml = jsonLd.articleBody;
  } else {
    bodyHtml = container.html() ?? "";
  }

  const bodyImages = imagesFromContainer($, container, pageUrl);
  const media = thumbnailUrl && !bodyImages.includes(thumbnailUrl) ? [thumbnailUrl, ...bodyImages] : bodyImages;

  const plainText = stripHtml(bodyHtml);
  const ogDescription = $('meta[property="og:description"]').attr("content")?.trim();
  const summary = jsonLd?.description?.trim() || ogDescription || truncate(plainText, 300);

  return {
    title,
    body: bodyHtml || plainText,
    summary,
    thumbnailUrl,
    media,
    author,
    publishedAt,
  };
}

export async function extractSinglePage(url: string): Promise<ExtractedItem> {
  const { text, finalUrl } = await safeFetchText(url);
  const $ = cheerio.load(text);
  const article = extractArticle($, finalUrl);
  return {
    title: article.title,
    url: normalizeUrl(finalUrl),
    summary: article.summary || null,
    body: article.body || null,
    thumbnailUrl: article.thumbnailUrl,
    media: article.media,
    author: article.author,
    publishedAt: article.publishedAt,
    guid: normalizeUrl(finalUrl),
    type: "article",
  };
}

interface ListingCandidate {
  title: string;
  url: string;
  thumbnailUrl: string | null;
  summary: string | null;
  publishedAt: Date | null;
}

/** Heuristically finds repeated "card" links on an index/listing page: an
 * anchor with meaningful text (and ideally an image) grouped by a shared
 * container, characteristic of blog/news index pages. */
function extractListingCandidates($: CheerioAPI, baseUrl: string): ListingCandidate[] {
  const seen = new Set<string>();
  const candidates: ListingCandidate[] = [];

  const $clean = stripNoise($);
  const scopes = $clean.find("article").length ? $clean.find("article").toArray() : $clean.find("a").toArray();
  const isArticleScoped = $clean.find("article").length > 0;

  for (const el of scopes) {
    const $scope = isArticleScoped ? $(el) : $(el).closest("li, div, article").length ? $(el).closest("li, div, article") : $(el);
    const $link = isArticleScoped ? $scope.find("a[href]").first() : $(el);

    const href = $link.attr("href");
    if (!href) continue;
    const absolute = toAbsoluteUrl(href, baseUrl);
    if (!absolute) continue;
    const normalized = normalizeUrl(absolute);
    if (seen.has(normalized)) continue;

    const heading = $scope.find("h1,h2,h3,h4").first().text().trim();
    const linkText = $link.text().trim();
    const title = heading || linkText;
    if (!title || title.length < 6 || title.length > 200) continue;

    // Skip obvious nav/utility links.
    if (/^(home|menu|login|sign in|previous|next|top|about|contact)$/i.test(title)) continue;

    const img = $scope.find("img").first();
    const thumbnailUrl = toAbsoluteUrl(img.attr("src") || img.attr("data-src") || img.attr("data-original"), baseUrl);

    const timeEl = $scope.find("time[datetime]").first();
    const publishedAt = parseDateLoose(timeEl.attr("datetime") || timeEl.text());

    const summaryText = $scope.find("p").first().text().trim();

    seen.add(normalized);
    candidates.push({
      title,
      url: normalized,
      thumbnailUrl,
      summary: summaryText ? truncate(summaryText, 300) : null,
      publishedAt,
    });
  }

  return candidates;
}

const MAX_LISTING_ITEMS = 30;
const MAX_ENRICH_ITEMS = 12;
const ENRICH_CONCURRENCY = 3;

/**
 * Parses a site with no discoverable feed: looks for a listing of article
 * cards; if found, fetches the top N individually for full body text
 * (partial-success: a single article failing doesn't fail the whole batch).
 * Falls back to treating the page itself as one article.
 */
export async function fetchAndParseHtml(pageUrl: string): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const { text, finalUrl } = await safeFetchText(pageUrl);
  const $ = cheerio.load(text);

  const listing = extractListingCandidates($, finalUrl).slice(0, MAX_LISTING_ITEMS);

  if (listing.length < 2) {
    const article = extractArticle($, finalUrl);
    return {
      items: [
        {
          title: article.title,
          url: normalizeUrl(finalUrl),
          summary: article.summary || null,
          body: article.body || null,
          thumbnailUrl: article.thumbnailUrl,
          media: article.media,
          author: article.author,
          publishedAt: article.publishedAt,
          guid: normalizeUrl(finalUrl),
          type: "article",
        },
      ],
      parser: "html",
      confidence: 0.7,
      warnings,
      errors,
    };
  }

  const toEnrich = listing.slice(0, MAX_ENRICH_ITEMS);
  const rest = listing.slice(MAX_ENRICH_ITEMS);

  const enriched = await mapWithConcurrency(toEnrich, ENRICH_CONCURRENCY, async (candidate) => {
    const full = await extractSinglePage(candidate.url);
    return {
      ...full,
      title: full.title !== "(無題)" ? full.title : candidate.title,
      thumbnailUrl: full.thumbnailUrl || candidate.thumbnailUrl,
      publishedAt: full.publishedAt || candidate.publishedAt,
      summary: full.summary || candidate.summary,
    } satisfies ExtractedItem;
  });

  const items: ExtractedItem[] = [];
  enriched.forEach((result, i) => {
    if (result.status === "fulfilled") {
      items.push(result.value);
    } else {
      warnings.push(`記事の取得に失敗しました: ${toEnrich[i].title}`);
      // Fall back to the listing-page summary rather than dropping the item entirely.
      items.push({
        title: toEnrich[i].title,
        url: toEnrich[i].url,
        summary: toEnrich[i].summary,
        body: null,
        thumbnailUrl: toEnrich[i].thumbnailUrl,
        media: toEnrich[i].thumbnailUrl ? [toEnrich[i].thumbnailUrl as string] : [],
        author: null,
        publishedAt: toEnrich[i].publishedAt,
        guid: toEnrich[i].url,
        type: "article",
      });
    }
  });

  for (const candidate of rest) {
    items.push({
      title: candidate.title,
      url: candidate.url,
      summary: candidate.summary,
      body: null,
      thumbnailUrl: candidate.thumbnailUrl,
      media: candidate.thumbnailUrl ? [candidate.thumbnailUrl] : [],
      author: null,
      publishedAt: candidate.publishedAt,
      guid: candidate.url,
      type: "article",
    });
  }

  return {
    items,
    parser: "html",
    confidence: 0.65,
    warnings,
    errors,
  };
}
