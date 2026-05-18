import { NextResponse } from "next/server";
import { cleanupAnalysisDownloads } from "@/lib/cleanup";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const result = await cleanupAnalysisDownloads(params.id);
    return NextResponse.json(result);
  } catch (error) {
    await logError("api.analysis.cleanup-downloads", error, { analysisId: params.id });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
