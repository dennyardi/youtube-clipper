import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const payload = await request.json();
    const startSecond = Number(payload.startSecond);
    const endSecond = Number(payload.endSecond);

    if (!Number.isFinite(startSecond) || !Number.isFinite(endSecond) || endSecond <= startSecond) {
      return NextResponse.json({ error: "Start dan finish time tidak valid." }, { status: 400 });
    }

    const clip = await prisma.clipResult.update({
      where: { id: params.id },
      data: {
        startSecond,
        endSecond,
        duration: endSecond - startSecond,
      },
    });
    return NextResponse.json(clip);
  } catch (error) {
    await logError("api.clip.update", error, { clipId: params.id });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
