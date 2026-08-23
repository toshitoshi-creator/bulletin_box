import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE() {
  await prisma.$transaction([
    prisma.historyEntry.deleteMany(),
    prisma.collectionItem.deleteMany(),
    prisma.media.deleteMany(),
    prisma.contentItem.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.collection.deleteMany(),
    prisma.site.deleteMany(),
    prisma.settings.deleteMany(),
  ]);
  return NextResponse.json({ ok: true });
}
