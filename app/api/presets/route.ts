import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const presets = await prisma.promptPreset.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(presets);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const preset = await prisma.promptPreset.create({
      data: {
        name: String(payload.name || "").trim(),
        description: String(payload.description || "").trim(),
        prompt: String(payload.prompt || "").trim(),
      },
    });
    return NextResponse.json(preset);
  } catch (error) {
    await logError("api.presets.create", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
