import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const payload = await request.json();
    const preset = await prisma.promptPreset.update({
      where: { id: Number(params.id) },
      data: {
        name: String(payload.name || "").trim(),
        description: String(payload.description || "").trim(),
        prompt: String(payload.prompt || "").trim(),
      },
    });
    return NextResponse.json(preset);
  } catch (error) {
    await logError("api.presets.update", error, { presetId: params.id });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    await prisma.promptPreset.delete({ where: { id: Number(params.id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await logError("api.presets.delete", error, { presetId: params.id });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
