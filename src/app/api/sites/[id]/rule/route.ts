import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveSiteRuleSchema } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api-response";
import { refreshSite } from "@/lib/fetch/pipeline";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = await prisma.siteRule.findUnique({ where: { siteId: id } });
  if (!rule) return jsonError("ルールが見つかりません。", 404);
  return NextResponse.json({ rule });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data = saveSiteRuleSchema.parse(body);

    await prisma.site.findUniqueOrThrow({ where: { id } });

    const rule = await prisma.siteRule.upsert({
      where: { siteId: id },
      update: {
        listUrl: data.listUrl,
        index: data.index,
        detail: data.detail ?? undefined,
        enabled: true,
      },
      create: {
        siteId: id,
        listUrl: data.listUrl,
        index: data.index,
        detail: data.detail ?? undefined,
        enabled: true,
      },
    });

    const result = await refreshSite(id);

    return NextResponse.json({ rule, itemCount: result.itemCount, warnings: result.warnings, errors: result.errors });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.siteRule.delete({ where: { siteId: id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
