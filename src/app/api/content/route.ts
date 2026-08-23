import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { contentListQuerySchema } from "@/lib/validation";
import { contentInclude, serializeContent } from "@/lib/serialize";
import { handleApiError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const query = contentListQuerySchema.parse(params);

    const where: Prisma.ContentItemWhereInput = {};
    if (query.siteId) where.siteId = query.siteId;
    if (query.type) where.type = query.type;
    if (query.favorite) where.isFavorite = true;
    if (query.saved) where.isSaved = true;
    if (query.unread) where.isRead = false;
    if (query.tag) where.tags = { some: { name: query.tag } };
    if (query.collectionId) where.collections = { some: { collectionId: query.collectionId } };
    if (query.q) {
      const q = query.q;
      where.OR = [
        { title: { contains: q } },
        { summary: { contains: q } },
        { body: { contains: q } },
        { author: { contains: q } },
        { site: { name: { contains: q } } },
        { tags: { some: { name: { contains: q } } } },
      ];
    }

    const orderBy: Prisma.ContentItemOrderByWithRelationInput =
      query.sort === "title"
        ? { title: "asc" }
        : query.sort === "updated"
          ? { updatedAt: "desc" }
          : query.sort === "saved"
            ? { createdAt: "desc" }
            : { publishedAt: "desc" };

    const [items, total] = await Promise.all([
      prisma.contentItem.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: contentInclude,
      }),
      prisma.contentItem.count({ where }),
    ]);

    return NextResponse.json({
      items: items.map(serializeContent),
      total,
      page: query.page,
      pageSize: query.pageSize,
      hasMore: query.page * query.pageSize < total,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
