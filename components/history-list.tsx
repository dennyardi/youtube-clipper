"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

type AnalysisRow = {
  id: string;
  videoTitle: string | null;
  videoId: string;
  type: string;
  status: string;
  createdAt: Date;
  preset: { name: string } | null;
  _count: { clips: number };
};

export function HistoryList({ analyses }: { analyses: AnalysisRow[] }) {
  const router = useRouter();

  async function remove(id: string) {
    const ok = window.confirm("Hapus record analisa ini beserta semua clip dan hook/teaser?");
    if (!ok) return;

    const response = await fetch(`/api/analysis/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json();
      alert(data.error || "Gagal menghapus analisa.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-panel">
          <tr>
            <th className="border-b border-line px-4 py-3">Tanggal</th>
            <th className="border-b border-line px-4 py-3">Video</th>
            <th className="border-b border-line px-4 py-3">Tipe</th>
            <th className="border-b border-line px-4 py-3">Preset</th>
            <th className="border-b border-line px-4 py-3">Clip</th>
            <th className="border-b border-line px-4 py-3">Status</th>
            <th className="border-b border-line px-4 py-3">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((analysis) => (
            <tr key={analysis.id} className="border-b border-line last:border-0">
              <td className="whitespace-nowrap px-4 py-3 text-muted">{new Date(analysis.createdAt).toLocaleString("id-ID")}</td>
              <td className="max-w-md px-4 py-3">
                <Link className="font-medium text-brand hover:text-blue-700" href={`/results/${analysis.id}`}>
                  {analysis.videoTitle || analysis.videoId}
                </Link>
              </td>
              <td className="px-4 py-3">{analysis.type}</td>
              <td className="px-4 py-3 text-muted">{analysis.preset?.name || "-"}</td>
              <td className="px-4 py-3">{analysis._count.clips}</td>
              <td className="px-4 py-3">{analysis.status}</td>
              <td className="px-4 py-3">
                <button className="btn btn-danger" onClick={() => remove(analysis.id)}>
                  <Trash2 size={16} />
                  Hapus
                </button>
              </td>
            </tr>
          ))}
          {!analyses.length && (
            <tr>
              <td className="px-4 py-6 text-muted" colSpan={7}>
                Belum ada riwayat analisa.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
