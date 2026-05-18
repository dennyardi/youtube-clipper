import { NextResponse } from "next/server";
import { AnalysisType } from "@prisma/client";
import { createAnalysis } from "@/lib/analysis-service";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const analysis = await createAnalysis({
      youtubeUrl: String(payload.youtubeUrl || ""),
      type: payload.type === "SHORT" ? AnalysisType.SHORT : AnalysisType.LONG,
      targetDuration: Number(payload.targetDuration || 3),
      minClipCount: Number(payload.minClipCount || 5),
      hookCount: Number(payload.hookCount || 1),
      presetId: Number(payload.presetId),
      language: String(payload.language || "id"),
      minDurationSec: Number(payload.minDurationSec || 30),
      maxDurationSec: Number(payload.maxDurationSec || 60),
      nicheFocus: String(payload.nicheFocus || ""),
      nicheMinDurationSec: Number(payload.nicheMinDurationSec || 5),
      nicheMaxDurationSec: Number(payload.nicheMaxDurationSec || 15),
    });
    return NextResponse.json({ analysisId: analysis.id });
  } catch (error) {
    await logError("api.analysis.create", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
