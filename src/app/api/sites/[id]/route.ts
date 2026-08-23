import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateSiteSchema } from "@/lib/validation";
import { serializeSite } from "@/lib/serialize";
import { handleApiError, jsonError } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = await prisma.site.findUnique({
    where: { id },
    include: { _count: { select: { content: true } } },
  });
  if (!site) return jsonError("サイトが見つかりません。", 404);
  return NextResponse.json({ site: serializeSite(site) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = updateSiteSchema.parse(body);
    const site = await prisma.site.update({
      where: { id },
      data,
      include: { _count: { select: { content: true } } },
    });
    return NextResponse.json({ site: serializeSite(site) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.site.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
