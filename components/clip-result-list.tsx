"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import { Clipboard, Download, Save, Trash2 } from "lucide-react";
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

type Segment = {
  id: string;
  startSecond: number;
  endSecond: number;
  text: string;
};

export function ClipResultList({
  analysisId,
  videoId,
  clips,
  segments = [],
  showTimestamps = false,
}: {
  analysisId: string;
  videoId: string;
  clips: Clip[];
  segments?: Segment[];
  showTimestamps?: boolean;
}) {
  const [items, setItems] = useState(clips);
  const [busy, setBusy] = useState<string | null>(null);
  const [cutMode, setCutMode] = useState<"FAST" | "PRECISE">("FAST");
  const [burnSubtitle, setBurnSubtitle] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<{
    jobId?: string;
    target?: string;
    status?: string;
    message?: string;
    error?: string;
  } | null>(null);
  const [recentJobs, setRecentJobs] = useState<Array<{
    id: string;
    type: string;
    mode: string;
    status: string;
    progressText: string | null;
    errorMessage: string | null;
    downloadUrl: string | null;
  }>>([]);
  const totalDuration = items.reduce((sum, clip) => sum + Math.max(0, clip.endSecond - clip.startSecond), 0);

  useEffect(() => {
    let stopped = false;

    async function loadJobs() {
      try {
        const response = await fetch(`/api/analysis/${analysisId}/download-jobs`, { cache: "no-store" });
        const data = await response.json();
        if (!stopped && Array.isArray(data)) setRecentJobs(data);
      } catch {
        if (!stopped) setRecentJobs([]);
      }
    }

    loadJobs();
    const timer = window.setInterval(loadJobs, 5000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [analysisId]);

  async function readJsonSafe(response: Response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { error: text.slice(0, 500) || `HTTP ${response.status}` };
    }
  }

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
    setDownloadStatus({ jobId, status: "PENDING", message: "Download masuk antrean..." });
    for (let attempt = 0; attempt < 240; attempt += 1) {
      const response = await fetch(`/api/download-jobs/${jobId}`);
      const data = await response.json();
      setDownloadStatus({
        jobId,
        status: data.status,
        message: data.progressText || "Memproses download...",
        error: data.errorMessage || null,
      });
      if (data.status === "COMPLETED" && data.downloadUrl) {
        setBusy(null);
        window.location.href = data.downloadUrl;
        return;
      }
      if (data.status === "FAILED") {
        setBusy(null);
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
    setBusy(null);
    setDownloadStatus({
      jobId,
      status: "PROCESSING",
      message: "Download masih diproses. Cek lagi beberapa saat.",
    });
  }

  async function downloadClip(id: string) {
    setBusy(id);
    setDownloadStatus({ target: id, status: "CREATING", message: "Membuat job download clip..." });
    const response = await fetch(`/api/clips/${id}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: cutMode, burnSubtitle }),
    });
    const data = await readJsonSafe(response);

    if (!response.ok) {
      setBusy(null);
      setDownloadStatus({ status: "FAILED", message: "Gagal membuat job download.", error: data.error || "Gagal mengunduh clip." });
      return;
    }

    setDownloadStatus({ jobId: data.jobId, target: id, status: "PENDING", message: "Job download dibuat. Menunggu antrean..." });
    waitForJob(data.jobId);
  }

  async function downloadHook(id: string) {
    const legacy = id.startsWith("legacy-");
    const realId = legacy ? id.replace("legacy-", "") : id;
    setBusy(id);
    setDownloadStatus({ target: id, status: "CREATING", message: "Membuat job download hook/teaser..." });
    const response = await fetch(legacy ? `/api/clips/${realId}/hook-download` : `/api/hooks/${id}/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: cutMode, burnSubtitle }),
    });
    const data = await readJsonSafe(response);

    if (!response.ok) {
      setBusy(null);
      setDownloadStatus({ status: "FAILED", message: "Gagal membuat job download hook.", error: data.error || "Gagal mengunduh hook/teaser." });
      return;
    }

    if (data.jobId) waitForJob(data.jobId);
    else {
      setBusy(null);
      window.location.href = data.downloadUrl;
    }
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

  async function cleanupDownloads() {
    const ok = window.confirm("Hapus semua file video tersimpan untuk analisa ini? Record analisa tetap disimpan.");
    if (!ok) return;

    setBusy("cleanup");
    setDownloadStatus({ status: "PROCESSING", message: "Membersihkan file video tersimpan..." });
    const response = await fetch(`/api/analysis/${analysisId}/cleanup-downloads`, { method: "POST" });
    const data = await readJsonSafe(response);
    setBusy(null);

    if (!response.ok) {
      setDownloadStatus({ status: "FAILED", message: "Gagal membersihkan file video.", error: data.error || "Cleanup gagal." });
      return;
    }

    setDownloadStatus({
      status: "COMPLETED",
      message: `Cleanup selesai. ${data.removed || 0} file dihapus dari ${data.checked || 0} job.`,
    });
  }

  async function copyTimestamps(text: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyMessage("Timestamp berhasil disalin.");
    } catch {
      setCopyMessage("Gagal menyalin timestamp.");
    }
    window.setTimeout(() => setCopyMessage(null), 2500);
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
        <button className="btn btn-danger" disabled={busy === "cleanup"} onClick={cleanupDownloads}>
          <Trash2 size={16} />
          Bersihkan File Video
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
      {downloadStatus && (
        <div
          className={`rounded-lg border p-4 text-sm shadow-soft ${
            downloadStatus.status === "FAILED"
              ? "border-red-200 bg-red-50 text-red-700"
              : downloadStatus.status === "COMPLETED"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-blue-200 bg-blue-50 text-blue-700"
          }`}
        >
          <div className="font-semibold">Status Download: {downloadStatus.status || "PENDING"}</div>
          <div className="mt-1">{downloadStatus.message}</div>
          {downloadStatus.error && <div className="mt-1 font-medium">{downloadStatus.error}</div>}
          {downloadStatus.jobId && <div className="mt-1 text-xs opacity-80">Job ID: {downloadStatus.jobId}</div>}
        </div>
      )}
      {!!recentJobs.length && (
        <div className="rounded-lg border border-line bg-white p-4 text-sm shadow-soft">
          <div className="mb-3 font-semibold">Riwayat Download Terbaru</div>
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <div key={job.id} className="rounded-md border border-line bg-panel px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    {job.type} - {job.mode} - {job.status}
                  </div>
                  {job.downloadUrl && (
                    <a className="text-brand hover:text-blue-700" href={job.downloadUrl}>
                      Unduh File
                    </a>
                  )}
                </div>
                <div className="mt-1 text-muted">{job.progressText || "Menunggu status..."}</div>
                {job.errorMessage && <div className="mt-1 font-medium text-red-700">{job.errorMessage}</div>}
                <div className="mt-1 text-xs text-muted">Job ID: {job.id}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {items.map((clip, index) => (
        <ClipResultCard
          key={clip.id}
          clip={clip}
          index={index}
          videoId={videoId}
          busy={busy}
          showTimestamps={showTimestamps}
          segments={segments}
          onCopyTimestamps={copyTimestamps}
          copyMessage={copyMessage}
          onUpdateClip={updateClip}
          onSetItems={setItems}
          onDownloadClip={downloadClip}
          onDownloadHook={downloadHook}
        />
      ))}
    </div>
  );
}

function ClipResultCard({
  clip,
  index,
  videoId,
  busy,
  showTimestamps,
  segments,
  copyMessage,
  onCopyTimestamps,
  onUpdateClip,
  onSetItems,
  onDownloadClip,
  onDownloadHook,
}: {
  clip: Clip;
  index: number;
  videoId: string;
  busy: string | null;
  showTimestamps: boolean;
  segments: Segment[];
  copyMessage: string | null;
  onCopyTimestamps: (text: string) => void;
  onUpdateClip: (id: string, startSecond: number, endSecond: number) => void;
  onSetItems: Dispatch<SetStateAction<Clip[]>>;
  onDownloadClip: (id: string) => void;
  onDownloadHook: (id: string) => void;
}) {
  const clipTimestamps = showTimestamps ? buildClipTimestamps(clip, segments) : "";

  return (
    <div className="grid gap-5 rounded-lg border border-line bg-white p-5 shadow-soft xl:grid-cols-[420px_minmax(0,1fr)]">
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

            {showTimestamps && clipTimestamps && (
              <div className="mt-3 rounded-md border border-line bg-panel px-3 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">Timestamp untuk Clip {index + 1}</div>
                    <div className="mt-1 text-xs text-muted">Timestamp relatif dari awal file clip yang akan diupload.</div>
                  </div>
                  <button className="btn btn-muted py-1.5" onClick={() => onCopyTimestamps(clipTimestamps)}>
                    <Clipboard size={14} />
                    Copy
                  </button>
                </div>
                <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-white p-3 leading-6 text-ink">
                  {clipTimestamps}
                </pre>
                {copyMessage && <div className="mt-2 text-xs font-medium text-brand">{copyMessage}</div>}
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
                        <button className="btn btn-muted py-1.5" disabled={busy === hook.id} onClick={() => onDownloadHook(hook.id)}>
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
                    onSetItems((current) => current.map((item) => (item.id === clip.id ? { ...item, startSecond: value } : item)));
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
                    onSetItems((current) => current.map((item) => (item.id === clip.id ? { ...item, endSecond: value } : item)));
                  }}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn btn-muted" disabled={busy === clip.id} onClick={() => onUpdateClip(clip.id, clip.startSecond, clip.endSecond)}>
                <Save size={16} />
                Simpan Time
              </button>
              <button className="btn btn-primary" disabled={busy === clip.id} onClick={() => onDownloadClip(clip.id)}>
                <Download size={16} />
                Download Clip
              </button>
            </div>
          </div>
        </div>
  );
}

function buildClipTimestamps(clip: Clip, segments: Segment[]) {
  const clipSegments = segments.filter((segment) => segment.endSecond >= clip.startSecond && segment.startSecond <= clip.endSecond);
  if (!clipSegments.length) {
    return `0:00 ${normalizeTimestampLabel(clip.title || clip.reason || "Awal pembahasan")}`;
  }

  const minGapSeconds = Math.max(30, Math.min(90, Math.round((clip.endSecond - clip.startSecond) / 4)));
  const markers: Array<{ second: number; label: string }> = [];

  for (const segment of clipSegments) {
    const relativeSecond = Math.max(0, segment.startSecond - clip.startSecond);
    const previous = markers[markers.length - 1];
    if (!previous || relativeSecond - previous.second >= minGapSeconds) {
      markers.push({
        second: relativeSecond,
        label: normalizeTimestampLabel(segment.text),
      });
    }
  }

  if (markers[0]?.second !== 0) {
    markers.unshift({ second: 0, label: normalizeTimestampLabel(clip.title || clip.reason || clipSegments[0].text) });
  }

  return markers
    .slice(0, 8)
    .map((marker) => `${secondsToClock(marker.second)} ${marker.label}`)
    .join("\n");
}

function normalizeTimestampLabel(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[#*_`~]/g, "")
    .trim()
    .slice(0, 90);
}
