import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addToCollectionSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { contentId } = addToCollectionSchema.parse(body);
    const item = await prisma.collectionItem.upsert({
      where: { collectionId_contentId: { collectionId: id, contentId } },
      update: {},
      create: { collectionId: id, contentId },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
