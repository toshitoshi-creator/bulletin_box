import type { Prisma } from "@/generated/prisma";

const contentWithRelations = {
  include: {
    site: { select: { id: true, name: true, iconUrl: true, domain: true } },
    tags: { select: { id: true, name: true } },
    media: { orderBy: { sortOrder: "asc" as const } },
    collections: { select: { collectionId: true, collection: { select: { name: true } } } },
  },
} satisfies Prisma.ContentItemDefaultArgs;

export type ContentItemWithRelations = Prisma.ContentItemGetPayload<typeof contentWithRelations>;

export const contentInclude = contentWithRelations.include;

export function serializeContent(item: ContentItemWithRelations) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    summary: item.summary,
    body: item.body,
    url: item.url,
    canonicalUrl: item.canonicalUrl,
    thumbnailUrl: item.thumbnailUrl,
    author: item.author,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    isRead: item.isRead,
    isFavorite: item.isFavorite,
    isSaved: item.isSaved,
    readProgress: item.readProgress,
    tags: item.tags.map((t) => t.name),
    media: item.media.map((m) => ({ id: m.id, url: m.url, type: m.type, alt: m.alt })),
    collectionIds: item.collections.map((c) => c.collectionId),
    site: {
      id: item.site.id,
      name: item.site.name,
      iconUrl: item.site.iconUrl,
      domain: item.site.domain,
    },
  };
}

export function serializeSite(site: {
  id: string;
  name: string;
  url: string;
  domain: string;
  iconUrl: string | null;
  description: string | null;
  feedUrl: string | null;
  feedType: string;
  viewMode: string;
  isEnabled: boolean;
  lastFetchedAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { content: number };
}) {
  return {
    id: site.id,
    name: site.name,
    url: site.url,
    domain: site.domain,
    iconUrl: site.iconUrl,
    description: site.description,
    feedUrl: site.feedUrl,
    feedType: site.feedType,
    viewMode: site.viewMode,
    isEnabled: site.isEnabled,
    lastFetchedAt: site.lastFetchedAt?.toISOString() ?? null,
    lastSuccessAt: site.lastSuccessAt?.toISOString() ?? null,
    lastError: site.lastError,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
    contentCount: site._count?.content ?? undefined,
  };
}
