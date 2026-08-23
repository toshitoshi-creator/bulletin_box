import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateCollectionSchema } from "@/lib/validation";
import { contentInclude, serializeContent } from "@/lib/serialize";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { addedAt: "desc" },
        include: { content: { include: contentInclude } },
      },
    },
  });
  if (!collection) return jsonError("コレクションが見つかりません。", 404);
  return NextResponse.json({
    collection: {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      icon: collection.icon,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
      items: collection.items.map((i) => serializeContent(i.content)),
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateCollectionSchema.parse(body);
    const collection = await prisma.collection.update({ where: { id }, data });
    return NextResponse.json({ collection });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.collection.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
