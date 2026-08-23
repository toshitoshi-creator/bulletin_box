import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateContentSchema } from "@/lib/validation";
import { contentInclude, serializeContent } from "@/lib/serialize";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.contentItem.findUnique({ where: { id }, include: contentInclude });
  if (!item) return jsonError("コンテンツが見つかりません。", 404);
  return NextResponse.json({ item: serializeContent(item) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateContentSchema.parse(body);

    const { tags, ...rest } = data;

    const item = await prisma.contentItem.update({
      where: { id },
      data: {
        ...rest,
        ...(tags
          ? {
              tags: {
                set: [],
                connectOrCreate: tags.map((name) => ({
                  where: { name },
                  create: { name },
                })),
              },
            }
          : {}),
      },
      include: contentInclude,
    });

    return NextResponse.json({ item: serializeContent(item) });
  } catch (err) {
    return handleApiError(err);
  }
}
