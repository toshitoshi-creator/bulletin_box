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
  '[id*="banner" i]',
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
  '[class*="post-header" i]',
  '[class*="entry-header" i]',
  '[class*="article-header" i]',
  '[class*="page-header" i]',
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

function candidateFromScope(
  $: CheerioAPI,
  $scope: ReturnType<CheerioAPI>,
  $link: ReturnType<CheerioAPI>,
  baseUrl: string,
  seen: Set<string>
): ListingCandidate | null {
  const href = $link.attr("href");
  if (!href) return null;
  const absolute = toAbsoluteUrl(href, baseUrl);
  if (!absolute) return null;
  const normalized = normalizeUrl(absolute);
  if (seen.has(normalized)) return null;

  const heading = $scope.find("h1,h2,h3,h4").first().text().trim();
  const linkText = $link.text().trim();
  const title = heading || linkText;
  // CJK text carries far more meaning per character than space-separated Latin
  // words, so a short Japanese/Chinese headline can be well under 6 characters.
  if (!title || title.length < 3 || title.length > 200) return null;

  // Skip obvious nav/utility links (English and common Japanese/Chinese labels).
  if (
    /^(home|menu|login|sign in|previous|next|top|about|contact)$/i.test(title) ||
    /^(ホーム|メニュー|検索|ログイン|次へ|前へ|一覧|トップ|もっと見る|お問い合わせ|首頁|選單|登入|下一頁|上一頁|更多)$/.test(title)
  ) {
    return null;
  }

  const img = $scope.find("img").first();
  const thumbnailUrl = toAbsoluteUrl(img.attr("src") || img.attr("data-src") || img.attr("data-original"), baseUrl);

  const timeEl = $scope.find("time[datetime]").first();
  const publishedAt = parseDateLoose(timeEl.attr("datetime") || timeEl.text());

  const summaryText = $scope.find("p").first().text().trim();

  seen.add(normalized);
  return {
    title,
    url: normalized,
    thumbnailUrl,
    summary: summaryText ? truncate(summaryText, 300) : null,
    publishedAt,
  };
}

// Below this many candidates from the precise patterns (<article>, repeated
// siblings), we don't yet trust that we've found the site's real card
// structure, so the noisier generic-link fallback still runs. At or above
// it, the precise patterns are doing their job and the generic scan would
// only add noise (stray sidebar/nav links that happen to have a
// heading-like label).
const MIN_PRECISE_CANDIDATES = 3;
// How many siblings sharing the same class must appear under one parent
// before we trust it's a real repeated card list (a Bootstrap row>col grid,
// a plain-div card list, etc.) rather than coincidence.
const MIN_SIBLING_GROUP = 3;

/** Finds groups of >=MIN_SIBLING_GROUP sibling elements under the same
 * parent that share the exact same class attribute — the structural
 * signature of a repeated card grid, regardless of what the site happens to
 * name its classes (Bootstrap's col-md-4, a CMS's news-card, anything). A
 * lone element with a matching class name but no repeated siblings (e.g. an
 * unrelated one-off link elsewhere on the page) never qualifies. */
function findSiblingGroupScopes($: CheerioAPI, $clean: ReturnType<CheerioAPI>) {
  const byParentAndClass = new Map<object, Map<string, object[]>>();

  $clean.find("[class]").each((_, el) => {
    const parent = (el as { parent?: object | null }).parent;
    if (!parent) return;
    const className = $(el).attr("class")?.trim();
    if (!className) return;
    let classMap = byParentAndClass.get(parent);
    if (!classMap) {
      classMap = new Map();
      byParentAndClass.set(parent, classMap);
    }
    const group = classMap.get(className) ?? [];
    group.push(el);
    classMap.set(className, group);
  });

  const scopes: object[] = [];
  for (const classMap of byParentAndClass.values()) {
    for (const siblings of classMap.values()) {
      if (siblings.length >= MIN_SIBLING_GROUP) scopes.push(...siblings);
    }
  }
  return scopes;
}

/** Heuristically finds repeated "card" links on an index/listing page: an
 * anchor with meaningful text (and ideally an image) grouped by a shared
 * container, characteristic of blog/news index pages. Scans semantic
 * <article> wrappers and repeated-sibling card grids (Bootstrap row>col,
 * plain divs, anything — see findSiblingGroupScopes) and merges both, since
 * real pages often mix patterns (e.g. a small "featured" <article> section
 * next to a main grid). Only falls back to a generic "any link with a
 * heading" scan when those precise patterns didn't find enough, since that
 * scan can't distinguish a real article card from an unrelated link
 * elsewhere on the page. */
function extractListingCandidates($: CheerioAPI, baseUrl: string): ListingCandidate[] {
  const seen = new Set<string>();
  const candidates: ListingCandidate[] = [];
  const $clean = stripNoise($);

  for (const el of $clean.find("article").toArray()) {
    const $scope = $(el);
    const $link = $scope.find("a[href]").first();
    const candidate = candidateFromScope($, $scope, $link, baseUrl, seen);
    if (candidate) candidates.push(candidate);
  }

  for (const el of findSiblingGroupScopes($, $clean)) {
    const $scope = $(el as never);
    const $link = $scope.is("a[href]") ? $scope : $scope.find("a[href]").first();
    const candidate = candidateFromScope($, $scope, $link, baseUrl, seen);
    if (candidate) candidates.push(candidate);
  }

  if (candidates.length >= MIN_PRECISE_CANDIDATES) return candidates;

  for (const el of $clean.find("a[href]").toArray()) {
    const $link = $(el);
    const $scope = $link.closest("li, div, article").length ? $link.closest("li, div, article") : $link;
    const candidate = candidateFromScope($, $scope, $link, baseUrl, seen);
    if (candidate) candidates.push(candidate);
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
