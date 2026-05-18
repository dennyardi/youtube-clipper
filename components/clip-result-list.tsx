"use client";

import { useState } from "react";
import { Download, Save } from "lucide-react";
import { YoutubePreview } from "@/components/youtube-preview";
import { secondsToClock } from "@/lib/time";

type Clip = {
  id: string;
  title: string | null;
  caption?: string | null;
  hashtags?: string | null;
  reason: string;
  startSecond: number;
  endSecond: number;
  hookStart: number | null;
  hookEnd: number | null;
  hookReason: string | null;
  hooks?: Array<{
    id: string;
    title: string | null;
    reason: string | null;
    startSecond: number;
    endSecond: number;
    duration: number;
  }>;
};

export function ClipResultList({ analysisId, videoId, clips }: { analysisId: string; videoId: string; clips: Clip[] }) {
  const [items, setItems] = useState(clips);
  const [busy, setBusy] = useState<string | null>(null);
  const [cutMode, setCutMode] = useState<"FAST" | "PRECISE">("FAST");
  const [burnSubtitle, setBurnSubtitle] = useState(false);
  const totalDuration = items.reduce((sum, clip) => sum + Math.max(0, clip.endSecond - clip.startSecond), 0);

  async function updateClip(id: string, startSecond: number, endSecond: number) {
    setBusy(id);
    const response = await fetch(`/api/clips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startSecond, endSecond }),
    });
    const data = await response.json();
    if (response.ok) {
      setItems((current) => current.map((clip) => (clip.id === id ? { ...clip, startSecond, endSecond } : clip)));
    } else {
      alert(data.error || "Gagal menyimpan clip.");
    }
    setBusy(null);
  }

  async function waitForJob(jobId: string) {
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const response = await fetch(`/api/download-jobs/${jobId}`);
      const data = await response.json();
      if (data.status === "COMPLETED" && data.downloadUrl) {
        window.location.href = data.downloadUrl;
        return;
      }
      if (data.status === "FAILED") {
        alert(data.errorMessage || "Download gagal.");
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    alert("Download masih diproses. Cek lagi beberapa saat.");
  }

  async function downloadClip(id: string) {
    setBusy(id);
    const response = await fetch(`/api/clips/${id}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: cutMode, burnSubtitle }),
    });
    const data = await response.json();
    setBusy(null);

    if (!response.ok) {
      alert(data.error || "Gagal mengunduh clip.");
      return;
    }

    waitForJob(data.jobId);
  }

  async function downloadHook(id: string) {
    const legacy = id.startsWith("legacy-");
    const realId = legacy ? id.replace("legacy-", "") : id;
    setBusy(id);
    const response = await fetch(legacy ? `/api/clips/${realId}/hook-download` : `/api/hooks/${id}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: cutMode, burnSubtitle }),
    });
    const data = await response.json();
    setBusy(null);

    if (!response.ok) {
      alert(data.error || "Gagal mengunduh hook/teaser.");
      return;
    }

    if (data.jobId) waitForJob(data.jobId);
    else window.location.href = data.downloadUrl;
  }

  async function reanalyze() {
    setBusy(analysisId);
    const response = await fetch(`/api/analysis/${analysisId}/reanalyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      alert(data.error || "Gagal menjalankan analisis ulang.");
      return;
    }
    window.location.href = `/results/${data.analysisId}`;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Total Clip</div>
          <div className="mt-1 text-2xl font-semibold">{items.length}</div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Total Durasi Hasil</div>
          <div className="mt-1 text-2xl font-semibold">{secondsToClock(totalDuration)}</div>
        </div>
        <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Video ID</div>
          <div className="mt-1 truncate text-lg font-semibold">{videoId}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-white p-4 shadow-soft">
        <button className="btn btn-primary" disabled={busy === analysisId} onClick={reanalyze}>
          Re-Analyze
        </button>
        <label className="flex items-center gap-2 text-sm font-medium">
          Mode Cut
          <select className="field w-36" value={cutMode} onChange={(event) => setCutMode(event.target.value as "FAST" | "PRECISE")}>
            <option value="FAST">Fast</option>
            <option value="PRECISE">Precise</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={burnSubtitle} onChange={(event) => setBurnSubtitle(event.target.checked)} />
          Burn-in subtitle
        </label>
      </div>
      {items.map((clip, index) => (
        <div key={clip.id} className="grid gap-5 rounded-lg border border-line bg-white p-5 shadow-soft xl:grid-cols-[420px_minmax(0,1fr)]">
          <YoutubePreview videoId={videoId} start={clip.startSecond} end={clip.endSecond} />
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand">Clip {index + 1}</div>
            <h2 className="text-xl font-semibold">{clip.title || "Clip pilihan"}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium text-muted">
              <span className="rounded-md border border-line bg-panel px-2 py-1">
                Start: {secondsToClock(clip.startSecond)}
              </span>
              <span className="rounded-md border border-line bg-panel px-2 py-1">
                Finish: {secondsToClock(clip.endSecond)}
              </span>
              <span className="rounded-md border border-line bg-panel px-2 py-1">
                Durasi: {secondsToClock(Math.max(0, clip.endSecond - clip.startSecond))}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{clip.reason}</p>
            {(clip.caption || clip.hashtags) && (
              <div className="mt-3 rounded-md border border-line bg-panel px-3 py-2 text-sm">
                {clip.caption && <div className="leading-6">{clip.caption}</div>}
                {clip.hashtags && <div className="mt-2 font-medium text-brand">{clip.hashtags}</div>}
              </div>
            )}

            {(clip.hooks?.length || (clip.hookStart !== null && clip.hookEnd !== null)) && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                <div className="font-medium">Hook/Teaser</div>
                <div className="mt-2 space-y-2">
                  {(clip.hooks?.length
                    ? clip.hooks
                    : [
                        {
                          id: `legacy-${clip.id}`,
                          title: "Hook/Teaser",
                          reason: clip.hookReason,
                          startSecond: clip.hookStart || 0,
                          endSecond: clip.hookEnd || 0,
                          duration: Math.max(0, (clip.hookEnd || 0) - (clip.hookStart || 0)),
                        },
                      ]
                  ).map((hook, hookIndex) => (
                    <div key={hook.id} className="rounded-md border border-amber-200 bg-white px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">
                          {hook.title || `Hook ${hookIndex + 1}`}: {secondsToClock(hook.startSecond)} - {secondsToClock(hook.endSecond)}
                        </div>
                        <button className="btn btn-muted py-1.5" disabled={busy === hook.id} onClick={() => downloadHook(hook.id)}>
                          <Download size={14} />
                          Download Hook
                        </button>
                      </div>
                      {hook.reason && <div className="mt-1 text-muted">{hook.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-medium text-muted">Start Time (detik)</span>
                <input
                  className="field"
                  type="number"
                  defaultValue={Math.round(clip.startSecond)}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setItems((current) => current.map((item) => (item.id === clip.id ? { ...item, startSecond: value } : item)));
                  }}
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-medium text-muted">Finish Time (detik)</span>
                <input
                  className="field"
                  type="number"
                  defaultValue={Math.round(clip.endSecond)}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setItems((current) => current.map((item) => (item.id === clip.id ? { ...item, endSecond: value } : item)));
                  }}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-muted" disabled={busy === clip.id} onClick={() => updateClip(clip.id, clip.startSecond, clip.endSecond)}>
                <Save size={16} />
                Simpan Time
              </button>
              <button className="btn btn-primary" disabled={busy === clip.id} onClick={() => downloadClip(clip.id)}>
                <Download size={16} />
                Download Clip
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
