import { AnalysisForm } from "@/components/analysis-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ShortAnalysisPage() {
  const presets = await prisma.promptPreset.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <PageHeader
        title="Analisis Short Video"
        description="Cari satu kesatuan clip pendek yang utuh dan berpotensi viral, dengan range durasi yang bisa diatur langsung dari halaman ini."
      />
      <AnalysisForm type="SHORT" presets={presets} />
    </>
  );
}
