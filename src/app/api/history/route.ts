import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { contentInclude, serializeContent } from "@/lib/serialize";

export async function GET() {
  const entries = await prisma.historyEntry.findMany({
    orderBy: { viewedAt: "desc" },
    take: 200,
    include: { content: { include: contentInclude } },
  });
  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      viewedAt: e.viewedAt.toISOString(),
      progress: e.progress,
      content: serializeContent(e.content),
    })),
  });
}

export async function DELETE() {
  await prisma.historyEntry.deleteMany({});
  return NextResponse.json({ ok: true });
}
