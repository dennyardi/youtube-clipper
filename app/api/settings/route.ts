import { NextResponse } from "next/server";
import { AnalysisMode } from "@prisma/client";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { getErrorMessage } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
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

  const dbApiKey = decryptSecret(setting.openaiApiKeyEnc);
  return NextResponse.json({
    id: setting.id,
    openaiModel: setting.openaiModel,
    analysisMode: setting.analysisMode,
    maxAiCandidates: setting.maxAiCandidates,
    apiKeySource: dbApiKey ? `database: ${maskSecret(dbApiKey)}` : process.env.OPENAI_API_KEY ? ".env configured" : "missing",
  });
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json();
    const analysisMode = payload.analysisMode === "FULL_AI" ? AnalysisMode.FULL_AI : AnalysisMode.HYBRID;
    const openaiApiKey = String(payload.openaiApiKey || "").trim();
    const setting = await prisma.setting.upsert({
      where: { id: 1 },
      update: {
        openaiModel: String(payload.openaiModel || "gpt-5.2").trim(),
        analysisMode,
        maxAiCandidates: Math.max(5, Math.min(100, Number(payload.maxAiCandidates || 40))),
        ...(openaiApiKey ? { openaiApiKeyEnc: encryptSecret(openaiApiKey) } : {}),
      },
      create: {
        id: 1,
        openaiModel: String(payload.openaiModel || "gpt-5.2").trim(),
        analysisMode,
        maxAiCandidates: Math.max(5, Math.min(100, Number(payload.maxAiCandidates || 40))),
        openaiApiKeyEnc: openaiApiKey ? encryptSecret(openaiApiKey) : null,
      },
    });
    const dbApiKey = decryptSecret(setting.openaiApiKeyEnc);
    return NextResponse.json({
      id: setting.id,
      openaiModel: setting.openaiModel,
      analysisMode: setting.analysisMode,
      maxAiCandidates: setting.maxAiCandidates,
      apiKeySource: dbApiKey ? `database: ${maskSecret(dbApiKey)}` : process.env.OPENAI_API_KEY ? ".env configured" : "missing",
    });
  } catch (error) {
    await logError("api.settings.update", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
