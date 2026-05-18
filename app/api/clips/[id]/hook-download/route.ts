import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { downloadClip } from "@/lib/downloader";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const clip = await prisma.clipResult.findUnique({
      where: { id: params.id },
      include: { analysis: true },
    });
    if (!clip) return NextResponse.json({ error: "Clip tidak ditemukan." }, { status: 404 });
    if (clip.hookStart === null || clip.hookEnd === null || clip.hookEnd <= clip.hookStart) {
      return NextResponse.json({ error: "Hook/teaser belum tersedia untuk clip ini." }, { status: 400 });
    }

    const outputPath = await downloadClip({
      clipId: `hook-legacy-${clip.id}`,
      youtubeUrl: clip.analysis.youtubeUrl,
      startSecond: clip.hookStart,
      endSecond: clip.hookEnd,
    });

    return NextResponse.json({ downloadUrl: `/api/clips/${clip.id}/hook-download` });
  } catch (error) {
    await logError("api.clip.hook-download", error, { clipId: params.id });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const filePath = path.join(process.cwd(), "downloads", `hook-legacy-${params.id}.mp4`);
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
