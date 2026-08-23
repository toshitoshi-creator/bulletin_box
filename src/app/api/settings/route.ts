import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateSettingsSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-response";

async function getOrCreateSettings() {
  return prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

export async function GET() {
  const settings = await getOrCreateSettings();
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const data = updateSettingsSchema.parse(body);
    await getOrCreateSettings();
    const settings = await prisma.settings.update({ where: { id: 1 }, data });
    return NextResponse.json({ settings });
  } catch (err) {
    return handleApiError(err);
  }
}
