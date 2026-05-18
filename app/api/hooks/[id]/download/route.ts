import fs from "node:fs";
import { NextResponse } from "next/server";
import { CutMode } from "@prisma/client";
import { createDownloadJob } from "@/lib/download-jobs";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const payload = await request.json().catch(() => ({}));
    const hook = await prisma.clipHook.findUnique({
      where: { id: params.id },
      include: { clip: { include: { analysis: true } } },
    });
    if (!hook) return NextResponse.json({ error: "Hook/teaser tidak ditemukan." }, { status: 404 });

    const job = await createDownloadJob({
      analysisId: hook.clip.analysisId,
      hookId: hook.id,
      type: "HOOK",
      mode: payload.mode === "PRECISE" ? CutMode.PRECISE : CutMode.FAST,
      burnSubtitle: Boolean(payload.burnSubtitle),
    });
    return NextResponse.json({ jobId: job.id, statusUrl: `/api/download-jobs/${job.id}` });
  } catch (error) {
    await logError("api.hook.download", error, { hookId: params.id });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const job = await prisma.downloadJob.findUnique({ where: { id: params.id } });
  const filePath = job?.filePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File hook/teaser belum tersedia." }, { status: 404 });
  }

  const stream = fs.createReadStream(filePath);
  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="hook-${params.id}.mp4"`,
    },
  });
}
