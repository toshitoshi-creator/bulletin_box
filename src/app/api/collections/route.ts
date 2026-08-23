import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createCollectionSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-response";

export async function GET() {
  const collections = await prisma.collection.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { items: true } } },
  });
  return NextResponse.json({
    collections: collections.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      itemCount: c._count.items,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createCollectionSchema.parse(body);
    const collection = await prisma.collection.create({ data });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
