import fs from "node:fs";
import { NextResponse } from "next/server";
import { cleanupExpiredDownloads } from "@/lib/cleanup";
import { kickDownloadQueue, markStaleJobsFailed } from "@/lib/download-jobs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  await cleanupExpiredDownloads();
  await markStaleJobsFailed();
  await kickDownloadQueue();
  const job = await prisma.downloadJob.findUnique({ where: { id: params.id } });
  if (!job) return NextResponse.json({ error: "Download job tidak ditemukan." }, { status: 404 });

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progressText: job.progressText,
    errorMessage: job.errorMessage,
    downloadUrl:
      job.status === "COMPLETED" && job.filePath && fs.existsSync(job.filePath)
        ? `/api/download-jobs/${job.id}/file`
        : null,
  });
}
