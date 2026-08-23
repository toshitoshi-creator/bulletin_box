import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registerSite } from "@/lib/fetch/pipeline";
import { registerSiteSchema } from "@/lib/validation";
import { serializeSite } from "@/lib/serialize";
import { handleApiError } from "@/lib/api-response";

export async function GET() {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { content: true } } },
  });
  return NextResponse.json({ sites: sites.map(serializeSite) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = registerSiteSchema.parse(body);
    const result = await registerSite(url);
    const site = await prisma.site.findUniqueOrThrow({
      where: { id: result.siteId },
      include: { _count: { select: { content: true } } },
    });
    return NextResponse.json(
      {
        site: serializeSite(site),
        itemCount: result.itemCount,
        warnings: result.warnings,
        errors: result.errors,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
