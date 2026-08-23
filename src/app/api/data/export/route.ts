import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const EXPORT_VERSION = 1;

export async function GET() {
  const [sites, collections, settings] = await Promise.all([
    prisma.site.findMany({
      include: { content: { include: { tags: true, media: true } } },
    }),
    prisma.collection.findMany({
      include: { items: { include: { content: { select: { url: true } } } } },
    }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);

  const payload = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    sites: sites.map((s) => ({
      name: s.name,
      url: s.url,
      domain: s.domain,
      iconUrl: s.iconUrl,
      description: s.description,
      feedUrl: s.feedUrl,
      feedType: s.feedType,
      viewMode: s.viewMode,
      content: s.content.map((c) => ({
        type: c.type,
        title: c.title,
        summary: c.summary,
        body: c.body,
        url: c.url,
        canonicalUrl: c.canonicalUrl,
        thumbnailUrl: c.thumbnailUrl,
        author: c.author,
        publishedAt: c.publishedAt?.toISOString() ?? null,
        guid: c.guid,
        isRead: c.isRead,
        isFavorite: c.isFavorite,
        isSaved: c.isSaved,
        readProgress: c.readProgress,
        tags: c.tags.map((t) => t.name),
        media: c.media.map((m) => ({ url: m.url, type: m.type, alt: m.alt, sortOrder: m.sortOrder })),
      })),
    })),
    collections: collections.map((c) => ({
      name: c.name,
      description: c.description,
      icon: c.icon,
      contentUrls: c.items.map((i) => i.content.url),
    })),
    settings: settings
      ? { theme: settings.theme, fontSize: settings.fontSize, defaultViewMode: settings.defaultViewMode }
      : null,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="webshelf-export-${Date.now()}.json"`,
    },
  });
}
