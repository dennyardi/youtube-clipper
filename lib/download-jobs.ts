import { CutMode, DownloadJobType } from "@prisma/client";
import { downloadClip } from "@/lib/downloader";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function createDownloadJob(args: {
  analysisId: string;
  clipId?: string;
  hookId?: string;
  type: DownloadJobType;
  mode: CutMode;
  burnSubtitle: boolean;
}) {
  const job = await prisma.downloadJob.create({
    data: {
      analysisId: args.analysisId,
      clipId: args.clipId,
      hookId: args.hookId,
      type: args.type,
      mode: args.mode,
      burnSubtitle: args.burnSubtitle,
      status: "PENDING",
      progressText: "Menunggu proses download...",
    },
  });

  processDownloadJob(job.id).catch((error) => console.error(error));
  return job;
}

export async function processDownloadJob(jobId: string) {
  const job = await prisma.downloadJob.findUnique({
    where: { id: jobId },
    include: {
      analysis: { include: { transcriptSegments: true } },
      clip: true,
      hook: { include: { clip: true } },
    },
  });
  if (!job) throw new Error("Download job tidak ditemukan.");

  try {
    await prisma.downloadJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", progressText: "Mengunduh video dan memotong clip..." },
    });

    const startSecond = job.type === "HOOK" ? job.hook?.startSecond : job.clip?.startSecond;
    const endSecond = job.type === "HOOK" ? job.hook?.endSecond : job.clip?.endSecond;
    if (startSecond === undefined || endSecond === undefined) throw new Error("Timestamp download tidak valid.");

    const subtitles = job.analysis.transcriptSegments
      .filter((segment) => segment.endSecond >= startSecond && segment.startSecond <= endSecond)
      .map((segment) => ({ startSecond: segment.startSecond, endSecond: segment.endSecond, text: segment.text }));

    const outputPath = await downloadClip({
      clipId: job.id,
      youtubeUrl: job.analysis.youtubeUrl,
      startSecond,
      endSecond,
      mode: job.mode,
      burnSubtitle: job.burnSubtitle,
      subtitles,
    });

    await prisma.downloadJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", progressText: "Download selesai.", filePath: outputPath },
    });

    if (job.clipId && job.type === "CLIP") {
      await prisma.clipResult.update({ where: { id: job.clipId }, data: { filePath: outputPath } });
    }
    if (job.hookId && job.type === "HOOK") {
      await prisma.clipHook.update({ where: { id: job.hookId }, data: { filePath: outputPath } });
    }
  } catch (error) {
    await logError("download-job", error, { jobId });
    await prisma.downloadJob.update({
      where: { id: job.id },
      data: { status: "FAILED", progressText: "Download gagal.", errorMessage: getErrorMessage(error) },
    });
  }
}
