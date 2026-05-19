import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const DEFAULT_MAX_AGE_HOURS = 24;

async function removeFileIfSafe(filePath?: string | null) {
  if (!filePath) return false;
  const downloadsDir = path.resolve(process.cwd(), "downloads");
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(downloadsDir)) return false;

  try {
    await fs.rm(resolved, { force: true });
    return true;
  } catch {
    return false;
  }
}

export async function cleanupExpiredDownloads(maxAgeHours = DEFAULT_MAX_AGE_HOURS) {
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  const jobs = await prisma.downloadJob.findMany({
    where: {
      status: "COMPLETED",
      filePath: { not: null },
      updatedAt: { lt: cutoff },
    },
  });

  let removed = 0;
  for (const job of jobs) {
    if (await removeFileIfSafe(job.filePath)) removed += 1;
    await prisma.downloadJob.update({
      where: { id: job.id },
      data: { filePath: null, progressText: "File lokal otomatis dibersihkan setelah 24 jam." },
    });
  }

  await prisma.clipResult.updateMany({
    where: { updatedAt: { lt: cutoff }, filePath: { not: null } },
    data: { filePath: null },
  });
  await prisma.clipHook.updateMany({
    where: { updatedAt: { lt: cutoff }, filePath: { not: null } },
    data: { filePath: null },
  });

  return { removed, checked: jobs.length };
}

export async function cleanupAnalysisDownloads(analysisId: string) {
  const jobs = await prisma.downloadJob.findMany({
    where: { analysisId, filePath: { not: null } },
  });

  let removed = 0;
  for (const job of jobs) {
    if (await removeFileIfSafe(job.filePath)) removed += 1;
  }

  await prisma.downloadJob.updateMany({
    where: { analysisId },
    data: { filePath: null, storageKey: null, progressText: "File video dibersihkan manual." },
  });
  await prisma.clipResult.updateMany({
    where: { analysisId },
    data: { filePath: null },
  });

  const clips = await prisma.clipResult.findMany({ where: { analysisId }, select: { id: true } });
  await prisma.clipHook.updateMany({
    where: { clipId: { in: clips.map((clip) => clip.id) } },
    data: { filePath: null },
  });

  return { removed, checked: jobs.length };
}
