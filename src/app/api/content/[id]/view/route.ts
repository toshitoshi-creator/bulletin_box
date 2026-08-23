import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api-response";

/** Records that the user opened this content: adds a history entry and marks it read.
 * Called once per page visit, separate from GET so SWR revalidation never double-records. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await prisma.contentItem.findUniqueOrThrow({ where: { id } });
    await prisma.$transaction([
      prisma.historyEntry.create({ data: { contentId: id, progress: item.readProgress } }),
      prisma.contentItem.update({ where: { id }, data: { isRead: true } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
