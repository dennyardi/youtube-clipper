import { HistoryList } from "@/components/history-list";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const analyses = await prisma.analysis.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      preset: true,
      _count: { select: { clips: true } },
    },
    take: 100,
  });

  return (
    <>
      <PageHeader title="Riwayat Analisa" description="Lihat kembali hasil analisis yang pernah dibuat dan hapus record yang tidak diperlukan." />
      <HistoryList analyses={analyses} />
    </>
  );
}
