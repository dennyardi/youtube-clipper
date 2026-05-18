"use client";

import { secondsToClock } from "@/lib/time";

type Segment = { id: string; startSecond: number; endSecond: number; text: string };
type Clip = { id: string; title: string | null; startSecond: number; endSecond: number };

export function TranscriptTimeline({ segments, clips }: { segments: Segment[]; clips: Clip[] }) {
  function isSelected(segment: Segment) {
    return clips.some((clip) => segment.endSecond >= clip.startSecond && segment.startSecond <= clip.endSecond);
  }

  return (
    <div className="mt-5 rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Transcript Viewer</h2>
          <p className="mt-1 text-sm text-muted">Segmen yang masuk hasil analisa ditandai agar mudah mengecek batas kalimat.</p>
        </div>
        <div className="text-sm font-medium text-muted">{segments.length} segmen</div>
      </div>
      <div className="max-h-[520px] space-y-2 overflow-auto pr-2">
        {segments.map((segment) => (
          <div key={segment.id} className={`rounded-md border px-3 py-2 text-sm ${isSelected(segment) ? "border-blue-200 bg-blue-50" : "border-line bg-white"}`}>
            <div className="mb-1 font-medium text-brand">
              {secondsToClock(segment.startSecond)} - {secondsToClock(segment.endSecond)}
            </div>
            <div className="leading-6 text-ink">{segment.text}</div>
          </div>
        ))}
        {!segments.length && <div className="text-sm text-muted">Transcript belum tersedia untuk hasil lama. Jalankan analisis ulang untuk menyimpan timeline.</div>}
      </div>
    </div>
  );
}
