import fs from "node:fs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSignedDownloadUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const job = await prisma.downloadJob.findUnique({ where: { id: params.id } });
  if (job?.storageKey) {
    const signedUrl = await createSignedDownloadUrl(job.storageKey);
    return NextResponse.redirect(signedUrl);
  }

  if (!job?.filePath || !fs.existsSync(job.filePath)) {
    return NextResponse.json({ error: "File belum tersedia." }, { status: 404 });
  }

  const stream = fs.createReadStream(job.filePath);
  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${job.id}.mp4"`,
    },
  });
}
