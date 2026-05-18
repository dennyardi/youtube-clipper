import { NextResponse } from "next/server";
import { cleanupExpiredDownloads } from "@/lib/cleanup";
import { markStaleJobsFailed, kickDownloadQueue } from "@/lib/download-jobs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  await cleanupExpiredDownloads();
  await markStaleJobsFailed();
  await kickDownloadQueue();

  const jobs = await prisma.downloadJob.findMany({
    where: { analysisId: params.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      mode: true,
      burnSubtitle: true,
      status: true,
      progressText: true,
      errorMessage: true,
      filePath: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    jobs.map((job) => ({
      ...job,
      downloadUrl: job.status === "COMPLETED" && job.filePath ? `/api/download-jobs/${job.id}/file` : null,
    })),
  );
}
