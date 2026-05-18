import { NextResponse } from "next/server";
import { reanalyzeFromExisting } from "@/lib/analysis-service";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  try {
    const payload = await request.json().catch(() => ({}));
    const analysis = await reanalyzeFromExisting(params.id, payload);
    return NextResponse.json({ analysisId: analysis.id });
  } catch (error) {
    await logError("api.analysis.reanalyze", error, { analysisId: params.id });
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
