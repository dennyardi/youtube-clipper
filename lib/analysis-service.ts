import { AnalysisMode, AnalysisType } from "@prisma/client";
import { buildClipCandidates } from "@/lib/candidates";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { analyzeFullTranscriptWithAI, analyzeHybridWithAI } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { runPythonScorer } from "@/lib/python-scorer";
import { getTranscript } from "@/lib/transcript";
import { extractVideoId } from "@/lib/youtube";

type CreateAnalysisInput = {
  youtubeUrl: string;
  type: AnalysisType;
  targetDuration: number;
  minClipCount: number;
  hookCount?: number;
  presetId: number;
  language: string;
  minDurationSec?: number;
  maxDurationSec?: number;
  nicheFocus?: string;
  nicheMinDurationSec?: number;
  nicheMaxDurationSec?: number;
};

export type ReanalyzeInput = Partial<Omit<CreateAnalysisInput, "youtubeUrl">>;

function validateInput(input: CreateAnalysisInput) {
  if (!input.youtubeUrl) throw new Error("URL YouTube wajib diisi.");
  if (!["LONG", "SHORT"].includes(input.type)) throw new Error("Tipe analisis tidak valid.");
  if (!["id", "en"].includes(input.language)) throw new Error("Bahasa subtitle tidak valid.");
  if (!Number.isFinite(input.minClipCount) || input.minClipCount < 1) throw new Error("Jumlah minimal clip tidak valid.");

  const targetDuration = Math.max(1, Math.min(60, Number(input.targetDuration || 3)));
  const minDuration =
    input.type === "SHORT"
      ? Math.max(5, Number(input.minDurationSec || 30))
      : Math.max(60, Number(input.minDurationSec || 300));
  const maxDuration =
    input.type === "SHORT"
      ? Math.max(minDuration, Number(input.maxDurationSec || 60))
      : Math.max(minDuration, Number(input.maxDurationSec || 600));

  if (input.type === "SHORT" && maxDuration > 180) {
    throw new Error("Durasi maksimal Shorts dibatasi 180 detik agar hasil tetap cocok untuk format pendek.");
  }
  if (input.type === "LONG" && maxDuration > 3600) {
    throw new Error("Durasi maksimal Long Video dibatasi 60 menit.");
  }

  const nicheMinDurationSec = input.type === "LONG" ? Math.max(1, Number(input.nicheMinDurationSec || 5)) : null;
  const nicheMaxDurationSec = input.type === "LONG" ? Math.max(Number(nicheMinDurationSec || 5), Number(input.nicheMaxDurationSec || 15)) : null;

  return {
    ...input,
    targetDuration,
    minDuration: Math.round(minDuration),
    maxDuration: Math.round(maxDuration),
    nicheFocus: String(input.nicheFocus || "").trim(),
    nicheMinDurationSec,
    nicheMaxDurationSec,
    minClipCount: Math.max(1, Math.min(20, Number(input.minClipCount || 5))),
    hookCount: input.type === "LONG" ? Math.max(1, Math.min(10, Number(input.hookCount || 1))) : 0,
  };
}

async function updateProgress(analysisId: string, progress: number, progressText: string) {
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { progress, progressText },
  });
}

type RawAiClip = {
  title: string;
  caption?: string | null;
  hashtags?: string[] | null;
  reason: string;
  startSecond: number;
  endSecond: number;
  hookStartSecond?: number | null;
  hookEndSecond?: number | null;
  hookReason?: string | null;
  hooks?: Array<{
    title?: string | null;
    reason?: string | null;
    startSecond: number;
    endSecond: number;
  }>;
};

function normalizeClipTiming(clip: RawAiClip, args: { minDuration: number; maxDuration: number }) {
  const startSecond = Math.max(0, Math.floor(Number(clip.startSecond)));
  let endSecond = Math.max(startSecond + 1, Math.ceil(Number(clip.endSecond)));
  const duration = endSecond - startSecond;

  if (duration > args.maxDuration) {
    endSecond = startSecond + args.maxDuration;
  }

  if (endSecond - startSecond < args.minDuration) {
    return null;
  }

  return {
    ...clip,
    startSecond,
    endSecond,
  };
}

function normalizeHooks(
  clip: RawAiClip,
  args: {
    hookCount: number;
    clipStart: number;
    clipEnd: number;
    minHookDuration?: number | null;
    maxHookDuration?: number | null;
  },
) {
  const rawHooks = clip.hooks?.length
    ? clip.hooks
    : clip.hookStartSecond !== null && clip.hookStartSecond !== undefined && clip.hookEndSecond
      ? [{ title: "Hook/Teaser", reason: clip.hookReason || null, startSecond: clip.hookStartSecond, endSecond: clip.hookEndSecond }]
      : [];

  return rawHooks
    .map((hook) => {
      const startSecond = Math.max(args.clipStart, Math.floor(Number(hook.startSecond)));
      let endSecond = Math.min(args.clipEnd, Math.ceil(Number(hook.endSecond)));
      const maxHookDuration = args.maxHookDuration || 0;
      if (maxHookDuration > 0 && endSecond - startSecond > maxHookDuration) {
        endSecond = startSecond + maxHookDuration;
      }
      if (endSecond > args.clipEnd) endSecond = args.clipEnd;
      const duration = endSecond - startSecond;
      if (duration <= 0) return null;
      if (args.minHookDuration && duration < args.minHookDuration) return null;
      return {
        title: hook.title || "Hook/Teaser",
        reason: hook.reason || null,
        startSecond,
        endSecond,
      };
    })
    .filter(
      (
        hook,
      ): hook is {
        title: string;
        reason: string | null;
        startSecond: number;
        endSecond: number;
      } => Boolean(hook),
    )
    .slice(0, args.hookCount);
}

export async function createAnalysis(input: CreateAnalysisInput) {
  const valid = validateInput(input);
  const setting =
    (await prisma.setting.findUnique({ where: { id: 1 } })) ||
    (await prisma.setting.create({
      data: {
        id: 1,
        openaiModel: process.env.DEFAULT_OPENAI_MODEL || "gpt-5.2",
        analysisMode: "HYBRID",
        maxAiCandidates: Number(process.env.MAX_AI_CANDIDATES || 40),
      },
    }));

  const preset = await prisma.promptPreset.findUnique({ where: { id: valid.presetId } });
  if (!preset) throw new Error("Preset prompt tidak ditemukan.");

  const videoId = extractVideoId(valid.youtubeUrl);
  const analysis = await prisma.analysis.create({
    data: {
      youtubeUrl: valid.youtubeUrl,
      videoId,
      type: valid.type,
      language: valid.language,
      targetDuration: valid.targetDuration,
      minClipCount: valid.minClipCount,
      hookCount: valid.hookCount,
      minDurationSec: valid.minDuration,
      maxDurationSec: valid.maxDuration,
      nicheFocus: valid.nicheFocus || null,
      nicheMinDurationSec: valid.nicheMinDurationSec,
      nicheMaxDurationSec: valid.nicheMaxDurationSec,
      presetId: preset.id,
      analysisMode: setting.analysisMode,
      status: "PROCESSING",
      progress: 5,
      progressText: "Menyiapkan analisis...",
    },
  });

  runAnalysisJob(analysis.id, {
    videoId,
    youtubeUrl: valid.youtubeUrl,
    type: valid.type,
    language: valid.language,
    minDuration: valid.minDuration,
    maxDuration: valid.maxDuration,
    targetDuration: valid.targetDuration,
    minClipCount: valid.minClipCount,
    hookCount: valid.hookCount,
    nicheFocus: valid.nicheFocus,
    nicheMinDurationSec: valid.nicheMinDurationSec,
    nicheMaxDurationSec: valid.nicheMaxDurationSec,
    preset,
    model: setting.openaiModel,
    mode: setting.analysisMode,
    maxAiCandidates: setting.maxAiCandidates,
  }).catch((error) => {
    console.error(error);
  });

  return analysis;
}

async function runAnalysisJob(
  analysisId: string,
  args: {
    videoId: string;
    youtubeUrl: string;
    type: AnalysisType;
    language: string;
    minDuration: number;
    maxDuration: number;
    targetDuration: number;
    minClipCount: number;
    hookCount: number;
    nicheFocus?: string | null;
    nicheMinDurationSec?: number | null;
    nicheMaxDurationSec?: number | null;
    preset: { name: string; prompt: string };
    model: string;
    mode: AnalysisMode;
    maxAiCandidates: number;
  },
) {
  try {
    await updateProgress(analysisId, 15, "Mengunduh subtitle...");
    const transcript = await getTranscript({ videoId: args.videoId, language: args.language });

    await prisma.analysis.update({
      where: { id: analysisId },
      data: { videoTitle: transcript.title, progress: 35, progressText: "Membuat kandidat clip..." },
    });

    await prisma.transcriptSegment.createMany({
      data: transcript.items.map((item) => ({
        analysisId,
        startSecond: item.start,
        endSecond: item.end,
        text: item.text,
      })),
    });

    const candidates = buildClipCandidates(transcript.items, args.minDuration, args.maxDuration);
    if (!candidates.length) throw new Error("Tidak ada kandidat clip yang cocok dengan range durasi tersebut.");

    let aiResult;
    if (args.mode === "HYBRID") {
      await updateProgress(analysisId, 55, "Menjalankan scoring Python...");
      const scored = await runPythonScorer({
        clips: candidates,
        language: args.language,
        preset: args.preset.name,
        minDuration: args.minDuration,
        maxDuration: args.maxDuration,
        limit: Math.max(args.minClipCount, args.maxAiCandidates),
      });

      await updateProgress(analysisId, 75, "Menganalisis kandidat terbaik dengan AI...");
      aiResult = await analyzeHybridWithAI({
        model: args.model,
        type: args.type,
        videoTitle: transcript.title,
        presetName: args.preset.name,
        presetPrompt: args.preset.prompt,
        targetDuration: args.targetDuration,
        minClipCount: args.minClipCount,
        hookCount: args.hookCount,
        minDuration: args.minDuration,
        maxDuration: args.maxDuration,
        nicheFocus: args.nicheFocus,
        nicheMinDuration: args.nicheMinDurationSec,
        nicheMaxDuration: args.nicheMaxDurationSec,
        candidates: scored.clips,
      });
    } else {
      await updateProgress(analysisId, 70, "Menganalisis transcript penuh dengan AI...");
      aiResult = await analyzeFullTranscriptWithAI({
        model: args.model,
        type: args.type,
        videoTitle: transcript.title,
        presetName: args.preset.name,
        presetPrompt: args.preset.prompt,
        targetDuration: args.targetDuration,
        minClipCount: args.minClipCount,
        hookCount: args.hookCount,
        minDuration: args.minDuration,
        maxDuration: args.maxDuration,
        nicheFocus: args.nicheFocus,
        nicheMinDuration: args.nicheMinDurationSec,
        nicheMaxDuration: args.nicheMaxDurationSec,
        transcriptText: transcript.text,
      });
    }

    await updateProgress(analysisId, 90, "Menyimpan hasil analisis...");
    const clips = (aiResult.clips || [])
      .filter((clip) => Number.isFinite(clip.startSecond) && Number.isFinite(clip.endSecond) && clip.endSecond > clip.startSecond)
      .map((clip) => normalizeClipTiming(clip, { minDuration: args.minDuration, maxDuration: args.maxDuration }))
      .filter((clip): clip is RawAiClip => Boolean(clip))
      .slice(0, Math.max(args.minClipCount, 1));

    if (!clips.length) throw new Error("AI tidak mengembalikan clip yang valid.");

    for (const clip of clips) {
      const hookRows = normalizeHooks(clip, {
        hookCount: args.hookCount || 0,
        clipStart: clip.startSecond,
        clipEnd: clip.endSecond,
        minHookDuration: args.nicheMinDurationSec,
        maxHookDuration: args.nicheMaxDurationSec,
      });

      await prisma.clipResult.create({
        data: {
          analysisId,
          title: clip.title,
          caption: clip.caption || null,
          hashtags: Array.isArray(clip.hashtags) ? clip.hashtags.join(" ") : null,
          reason: clip.reason,
          startSecond: clip.startSecond,
          endSecond: clip.endSecond,
          duration: clip.endSecond - clip.startSecond,
          hookStart: clip.hookStartSecond ?? hookRows[0]?.startSecond ?? null,
          hookEnd: clip.hookEndSecond ?? hookRows[0]?.endSecond ?? null,
          hookReason: clip.hookReason ?? hookRows[0]?.reason ?? null,
          hooks: {
            create: hookRows.map((hook) => ({
              title: hook.title || "Hook/Teaser",
              reason: hook.reason || null,
              startSecond: hook.startSecond,
              endSecond: hook.endSecond,
              duration: hook.endSecond - hook.startSecond,
            })),
          },
        },
      });
    }

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        nicheAnalysis: aiResult.nicheAnalysis || null,
        status: "COMPLETED",
        progress: 100,
        progressText: "Analisis selesai.",
      },
    });
  } catch (error) {
    await logError("analysis", error, { analysisId, videoId: args.videoId, mode: args.mode });
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "FAILED",
        errorMessage: getErrorMessage(error),
        progressText: "Analisis gagal.",
      },
    });
  }
}

export async function reanalyzeFromExisting(analysisId: string, overrides: ReanalyzeInput = {}) {
  const existing = await prisma.analysis.findUnique({ where: { id: analysisId } });
  if (!existing) throw new Error("Analisa lama tidak ditemukan.");

  return createAnalysis({
    youtubeUrl: existing.youtubeUrl,
    type: overrides.type || existing.type,
    targetDuration: overrides.targetDuration || existing.targetDuration,
    minClipCount: overrides.minClipCount || existing.minClipCount,
    hookCount: overrides.hookCount || existing.hookCount,
    presetId: overrides.presetId || existing.presetId || 1,
    language: overrides.language || existing.language,
    minDurationSec: overrides.minDurationSec || existing.minDurationSec || undefined,
    maxDurationSec: overrides.maxDurationSec || existing.maxDurationSec || undefined,
    nicheFocus: overrides.nicheFocus || existing.nicheFocus || undefined,
    nicheMinDurationSec: overrides.nicheMinDurationSec || existing.nicheMinDurationSec || undefined,
    nicheMaxDurationSec: overrides.nicheMaxDurationSec || existing.nicheMaxDurationSec || undefined,
  });
}
