import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/db";
import { contentHash, normalizeUrl } from "@/lib/fetch/normalize";
import { handleApiError, jsonError } from "@/lib/api-response";

const urlString = z.string().refine(
  (v) => {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  },
  { message: "URLの形式が正しくありません。" }
);

const importContentSchema = z.object({
  type: z.enum(["article", "image", "gallery", "video", "pdf", "link", "unknown"]).default("article"),
  title: z.string().min(1),
  summary: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  url: urlString,
  canonicalUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  guid: z.string().nullable().optional(),
  isRead: z.boolean().default(false),
  isFavorite: z.boolean().default(false),
  isSaved: z.boolean().default(false),
  readProgress: z.number().min(0).max(1).default(0),
  tags: z.array(z.string()).default([]),
});

const importSiteSchema = z.object({
  name: z.string().min(1),
  url: urlString,
  domain: z.string().min(1),
  iconUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  feedUrl: z.string().nullable().optional(),
  feedType: z.enum(["rss", "atom", "html", "json", "unknown"]).default("unknown"),
  viewMode: z.enum(["card", "grid", "list"]).default("card"),
  content: z.array(importContentSchema).default([]),
});

const importSchema = z.object({
  version: z.number(),
  sites: z.array(importSiteSchema).default([]),
  collections: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        contentUrls: z.array(z.string()).default([]),
      })
    )
    .default([]),
  settings: z
    .object({
      theme: z.enum(["system", "light", "dark"]).optional(),
      fontSize: z.number().optional(),
      defaultViewMode: z.enum(["card", "grid", "list"]).optional(),
    })
    .nullable()
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = importSchema.parse(body);

    let sitesImported = 0;
    let itemsImported = 0;

    for (const site of data.sites) {
      const siteUrl = normalizeUrl(site.url);
      const dbSite = await prisma.site.upsert({
        where: { url: siteUrl },
        update: {},
        create: {
          name: site.name,
          url: siteUrl,
          domain: site.domain,
          iconUrl: site.iconUrl ?? null,
          description: site.description ?? null,
          feedUrl: site.feedUrl ?? null,
          feedType: site.feedType,
          viewMode: site.viewMode,
        },
      });
      sitesImported++;

      for (const item of site.content) {
        const url = normalizeUrl(item.url);
        const hash = contentHash([dbSite.id, item.guid || url, item.title]);
        await prisma.contentItem.upsert({
          where: { contentHash: hash },
          update: {},
          create: {
            siteId: dbSite.id,
            type: item.type,
            title: item.title,
            summary: item.summary ?? null,
            body: item.body ?? null,
            url,
            canonicalUrl: item.canonicalUrl ?? url,
            thumbnailUrl: item.thumbnailUrl ?? null,
            author: item.author ?? null,
            publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
            guid: item.guid ?? null,
            isRead: item.isRead,
            isFavorite: item.isFavorite,
            isSaved: item.isSaved,
            readProgress: item.readProgress,
            contentHash: hash,
            tags: {
              connectOrCreate: item.tags.map((name) => ({ where: { name }, create: { name } })),
            },
          },
        });
        itemsImported++;
      }
    }

    let collectionsImported = 0;
    for (const collection of data.collections) {
      const existing = await prisma.collection.findFirst({ where: { name: collection.name } });
      const dbCollection =
        existing ??
        (await prisma.collection.create({
          data: {
            name: collection.name,
            description: collection.description ?? null,
            icon: collection.icon ?? null,
          },
        }));
      collectionsImported++;

      for (const url of collection.contentUrls) {
        const content = await prisma.contentItem.findFirst({ where: { url: normalizeUrl(url) } });
        if (!content) continue;
        await prisma.collectionItem.upsert({
          where: { collectionId_contentId: { collectionId: dbCollection.id, contentId: content.id } },
          update: {},
          create: { collectionId: dbCollection.id, contentId: content.id },
        });
      }
    }

    if (data.settings) {
      await prisma.settings.upsert({
        where: { id: 1 },
        update: data.settings,
        create: { id: 1, ...data.settings },
      });
    }

    return NextResponse.json({ sitesImported, itemsImported, collectionsImported });
  } catch (err) {
    if (err instanceof SyntaxError) return jsonError("JSONファイルの形式が正しくありません。", 400);
    if (err instanceof ZodError) return jsonError("インポートファイルの形式が正しくありません。", 400);
    return handleApiError(err);
  }
}
