import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { decryptSecret, maskSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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

  return (
    <>
      <PageHeader
        title="Setting"
        description="Atur model ChatGPT dan mode analisis. API key tetap disimpan di file .env supaya tidak ikut ter-push ke GitHub."
      />
      <SettingsForm
        setting={{
          openaiModel: setting.openaiModel,
          analysisMode: setting.analysisMode,
          maxAiCandidates: setting.maxAiCandidates,
          apiKeySource: decryptSecret(setting.openaiApiKeyEnc)
            ? `database: ${maskSecret(decryptSecret(setting.openaiApiKeyEnc))}`
            : process.env.OPENAI_API_KEY
              ? ".env configured"
              : "missing",
        }}
      />
    </>
  );
}
