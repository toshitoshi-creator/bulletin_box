import { prisma } from "@/lib/db";
import { discoverSite } from "./discovery";
import { fetchAndParseRss } from "./rss";
import { fetchAndParseHtml } from "./html";
import { normalizeUrl, contentHash, assertValidHttpUrl, toAbsoluteUrl } from "./normalize";
import type { ExtractionResult, ExtractedItem } from "./types";

/** Safety net for image URLs that reach us still relative (a lazy-load
 * attribute our extractor didn't recognize, a base-URL edge case, etc.):
 * resolve against the site's own URL so a genuinely relative path still
 * ends up absolute rather than being silently broken. Already-absolute
 * URLs pass through unchanged. */
function resolveAgainstSite(url: string | null | undefined, siteBaseUrl: string): string | null {
  if (!url) return null;
  return toAbsoluteUrl(url, siteBaseUrl);
}

export class SiteRegistrationError extends Error {}

export interface FetchRunResult {
  siteId: string;
  itemCount: number;
  warnings: string[];
  errors: string[];
}

function isValidItem(item: ExtractedItem): boolean {
  if (!item.title || !item.title.trim()) return false;
  try {
    const u = new URL(item.url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  } catch {
    return false;
  }
  return true;
}

/** Upserts extracted items as ContentItems, deduped by a stable content hash.
 * Invalid items (empty title / bad URL) are skipped rather than failing the batch. */
async function saveExtractionResult(
  siteId: string,
  siteBaseUrl: string,
  extraction: ExtractionResult
): Promise<number> {
  let saved = 0;
  for (const item of extraction.items) {
    if (!isValidItem(item)) continue;
    const hash = contentHash([siteId, item.guid || item.url, item.title]);
    const thumbnailUrl = resolveAgainstSite(item.thumbnailUrl, siteBaseUrl);
    const mediaData = (item.media ?? [])
      .map((url) => resolveAgainstSite(url, siteBaseUrl))
      .filter((url): url is string => url !== null)
      .map((url, i) => ({ url, type: "image", sortOrder: i }));
    try {
      await prisma.contentItem.upsert({
        where: { contentHash: hash },
        update: {
          title: item.title,
          summary: item.summary ?? null,
          body: item.body ?? null,
          thumbnailUrl,
          author: item.author ?? null,
          publishedAt: item.publishedAt ?? null,
          media: { deleteMany: {}, create: mediaData },
        },
        create: {
          siteId,
          type: item.type,
          title: item.title,
          summary: item.summary ?? null,
          body: item.body ?? null,
          url: item.url,
          canonicalUrl: item.url,
          thumbnailUrl,
          author: item.author ?? null,
          publishedAt: item.publishedAt ?? null,
          contentHash: hash,
          guid: item.guid ?? null,
          media: { create: mediaData },
        },
      });
      saved++;
    } catch {
      // Constraint or transient failure on a single item must not fail the whole batch.
    }
  }
  return saved;
}

/** Fetches + parses a registered site's current feed/page and upserts new content.
 * Never throws for fetch/parse failures — records lastError on the Site instead so
 * the UI can show a clear, recoverable error and the caller can retry. */
export async function refreshSite(siteId: string): Promise<FetchRunResult> {
  const site = await prisma.site.findUniqueOrThrow({ where: { id: siteId } });
  const now = new Date();

  let extraction: ExtractionResult;
  try {
    extraction = site.feedUrl
      ? await fetchAndParseRss(site.feedUrl)
      : await fetchAndParseHtml(site.url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "取得に失敗しました。";
    await prisma.site.update({
      where: { id: site.id },
      data: { lastFetchedAt: now, lastError: message },
    });
    return { siteId: site.id, itemCount: 0, warnings: [], errors: [message] };
  }

  const itemCount = await saveExtractionResult(site.id, site.url, extraction);

  await prisma.site.update({
    where: { id: site.id },
    data: {
      lastFetchedAt: now,
      lastSuccessAt: now,
      lastError: extraction.errors[0] ?? null,
    },
  });

  return { siteId: site.id, itemCount, warnings: extraction.warnings, errors: extraction.errors };
}

/** Registers a new site: discovers its feed (or falls back to HTML parsing),
 * creates the Site row, then performs the first content fetch via refreshSite. */
export async function registerSite(rawUrl: string): Promise<FetchRunResult> {
  const normalizedInput = normalizeUrl(rawUrl);
  try {
    assertValidHttpUrl(normalizedInput);
  } catch (err) {
    throw new SiteRegistrationError(err instanceof Error ? err.message : "URLの形式が正しくありません。");
  }

  const dup = await prisma.site.findUnique({ where: { url: normalizedInput } });
  if (dup) throw new SiteRegistrationError("このサイトはすでに登録されています。");

  const discovery = await discoverSite(normalizedInput);
  const siteUrl = normalizeUrl(discovery.finalUrl);
  const domain = new URL(siteUrl).hostname;

  const dupFinal = await prisma.site.findUnique({ where: { url: siteUrl } });
  if (dupFinal) throw new SiteRegistrationError("このサイトはすでに登録されています。");

  const site = await prisma.site.create({
    data: {
      name: discovery.siteName || domain,
      url: siteUrl,
      domain,
      iconUrl: discovery.iconUrl,
      description: discovery.description,
      feedUrl: discovery.feedUrl,
      feedType: discovery.feedUrl ? discovery.feedType : "html",
    },
  });

  return refreshSite(site.id);
}
