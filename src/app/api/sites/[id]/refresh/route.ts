import { NextRequest, NextResponse } from "next/server";
import { refreshSite } from "@/lib/fetch/pipeline";
import { handleApiError } from "@/lib/api-response";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const result = await refreshSite(id);
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
