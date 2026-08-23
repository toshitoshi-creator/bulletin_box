import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { discoverSite } from "@/lib/fetch/discovery";
import { normalizeUrl, assertValidHttpUrl } from "@/lib/fetch/normalize";
import { registerSiteSchema } from "@/lib/validation";
import { handleApiError, jsonError } from "@/lib/api-response";

/** Discovery-only preview step: does not persist anything. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = registerSiteSchema.parse(body);
    const normalized = normalizeUrl(url);
    assertValidHttpUrl(normalized);

    const discovery = await discoverSite(normalized);
    const siteUrl = normalizeUrl(discovery.finalUrl);
    const domain = new URL(siteUrl).hostname;

    const existing = await prisma.site.findFirst({ where: { OR: [{ url: normalized }, { url: siteUrl }] } });
    if (existing) return jsonError("このサイトはすでに登録されています。", 409);

    return NextResponse.json({
      url: siteUrl,
      domain,
      name: discovery.siteName || domain,
      iconUrl: discovery.iconUrl,
      description: discovery.description,
      feedUrl: discovery.feedUrl,
      feedType: discovery.feedUrl ? discovery.feedType : "html",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
