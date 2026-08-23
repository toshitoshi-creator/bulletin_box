import * as cheerio from "cheerio";
import { safeFetchText } from "./safeFetch";
import { toAbsoluteUrl } from "./normalize";
import type { SiteDiscovery, FeedType } from "./types";

const FEED_MIME_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/xml",
  "text/xml",
]);

const COMMON_FEED_PATHS = ["/feed", "/feed/", "/rss", "/rss.xml", "/atom.xml", "/feed.xml", "/index.xml"];

function looksLikeFeedXml(text: string): FeedType | null {
  const head = text.slice(0, 2000);
  if (/<feed[\s>]/i.test(head) && /xmlns=["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(head)) {
    return "atom";
  }
  if (/<rss[\s>]/i.test(head) || /<rdf:RDF[\s>]/i.test(head)) return "rss";
  if (/<feed[\s>]/i.test(head)) return "atom";
  return null;
}

/**
 * Given a site's homepage URL, discovers the best available machine-readable
 * feed (declared <link rel=alternate>, then common conventional paths), and
 * pulls basic site metadata (name/icon/description) from the page.
 */
export async function discoverSite(inputUrl: string): Promise<SiteDiscovery> {
  const { text, finalUrl } = await safeFetchText(inputUrl);
  const asFeedType = looksLikeFeedXml(text);

  if (asFeedType) {
    // The registered URL is itself a feed.
    const $ = cheerio.load(text, { xmlMode: true });
    const siteName = $("channel > title").first().text() || $("feed > title").first().text() || new URL(finalUrl).hostname;
    return {
      feedUrl: finalUrl,
      feedType: asFeedType,
      siteName: siteName.trim() || new URL(finalUrl).hostname,
      iconUrl: null,
      description: null,
      finalUrl,
    };
  }

  const $ = cheerio.load(text);

  let feedUrl: string | null = null;
  let feedType: FeedType = "unknown";

  $('link[rel="alternate"]').each((_, el) => {
    if (feedUrl) return;
    const type = ($(el).attr("type") || "").toLowerCase();
    const href = $(el).attr("href");
    if (!href) return;
    if (FEED_MIME_TYPES.has(type)) {
      feedUrl = toAbsoluteUrl(href, finalUrl);
      feedType = type.includes("atom") ? "atom" : "rss";
    }
  });

  if (!feedUrl) {
    for (const path of COMMON_FEED_PATHS) {
      const candidate = toAbsoluteUrl(path, finalUrl);
      if (!candidate) continue;
      try {
        const probe = await safeFetchText(candidate, { timeoutMs: 6000 });
        const type = looksLikeFeedXml(probe.text);
        if (type) {
          feedUrl = probe.finalUrl;
          feedType = type;
          break;
        }
      } catch {
        // ignore, try next candidate
      }
    }
  }

  const siteName =
    $('meta[property="og:site_name"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    new URL(finalUrl).hostname;

  const iconHref =
    $('link[rel="apple-touch-icon"]').attr("href") ||
    $('link[rel="icon"]').attr("href") ||
    $('link[rel="shortcut icon"]').attr("href") ||
    "/favicon.ico";
  const iconUrl = toAbsoluteUrl(iconHref, finalUrl);

  const description =
    $('meta[property="og:description"]').attr("content")?.trim() ||
    $('meta[name="description"]').attr("content")?.trim() ||
    null;

  return {
    feedUrl,
    feedType: feedUrl ? feedType : "html",
    siteName,
    iconUrl,
    description,
    finalUrl,
  };
}
