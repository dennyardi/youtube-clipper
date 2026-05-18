import { AnalysisForm } from "@/components/analysis-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LongAnalysisPage() {
  const presets = await prisma.promptPreset.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <PageHeader
        title="Analisis Long Video"
        description="Cari cuplikan panjang dari video YouTube, lengkap dengan hook atau teaser yang cocok diletakkan di awal."
      />
      <AnalysisForm type="LONG" presets={presets} />
    </>
  );
}
