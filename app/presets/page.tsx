import { PageHeader } from "@/components/page-header";
import { PresetManager } from "@/components/preset-manager";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PresetsPage() {
  const presets = await prisma.promptPreset.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <>
      <PageHeader title="Preset Analisis" description="Kelola instruksi ChatGPT tanpa perlu mengubah kode backend." />
      <PresetManager presets={presets} />
    </>
  );
}
