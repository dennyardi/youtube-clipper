import { notFound } from "next/navigation";
import { ClipResultList } from "@/components/clip-result-list";
import { PageHeader } from "@/components/page-header";
import { TranscriptTimeline } from "@/components/transcript-timeline";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: { params: Promise<{ analysisId: string }> }) {
  const resolvedParams = await params;
  const analysis = await prisma.analysis.findUnique({
    where: { id: resolvedParams.analysisId },
    include: {
      clips: { orderBy: { createdAt: "asc" }, include: { hooks: { orderBy: { createdAt: "asc" } } } },
      transcriptSegments: { orderBy: { startSecond: "asc" } },
      preset: true,
    },
  });

  if (!analysis) notFound();

  return (
    <>
      <PageHeader
        title="Hasil Analisis"
        description={`${analysis.videoTitle || analysis.videoId} - ${analysis.type} - ${analysis.preset?.name || "Preset"}`}
      />
      {analysis.nicheAnalysis && (
        <div className="mb-5 rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">Analisa Niche</div>
          <p className="text-sm leading-6 text-muted">{analysis.nicheAnalysis}</p>
        </div>
      )}
      <ClipResultList
        analysisId={analysis.id}
        videoId={analysis.videoId}
        clips={analysis.clips}
        segments={analysis.transcriptSegments}
        showTimestamps={analysis.type === "LONG"}
      />
      <TranscriptTimeline clips={analysis.clips} segments={analysis.transcriptSegments} />
    </>
  );
}
