import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { content: true } } },
  });
  return NextResponse.json({
    tags: tags.map((t) => ({ id: t.id, name: t.name, count: t._count.content })),
  });
}
