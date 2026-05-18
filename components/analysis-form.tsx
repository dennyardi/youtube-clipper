"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Play } from "lucide-react";
import { LoadingProgress } from "@/components/loading-progress";

type Preset = { id: number; name: string };

export function AnalysisForm({ type, presets }: { type: "LONG" | "SHORT"; presets: Preset[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [status, setStatus] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  async function poll(analysisId: string) {
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/analysis/${analysisId}/progress`);
      const data = await response.json();
      setProgress(data.progress || 0);
      setProgressText(data.progressText);
      setStatus(data.status);

      if (data.status === "COMPLETED") {
        window.clearInterval(timer);
        router.push(`/results/${analysisId}`);
      }
      if (data.status === "FAILED") {
        window.clearInterval(timer);
        setLoading(false);
        setError(data.errorMessage || "Analisis gagal.");
      }
    }, 1500);
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    setLoading(true);
    setProgress(5);
    setProgressText("Mengirim job analisis...");

    const payload = {
      youtubeUrl: formData.get("youtubeUrl"),
      type,
      targetDuration: Number(formData.get("targetDuration") || 3),
      minClipCount: Number(formData.get("minClipCount") || 5),
      hookCount: Number(formData.get("hookCount") || 1),
      presetId: Number(formData.get("presetId")),
      language: formData.get("language"),
      minDurationSec:
        type === "LONG"
          ? Number(formData.get("minDurationMin") || 5) * 60
          : Number(formData.get("minDurationSec") || 30),
      maxDurationSec:
        type === "LONG"
          ? Number(formData.get("maxDurationMin") || 10) * 60
          : Number(formData.get("maxDurationSec") || 60),
      nicheFocus: "",
      nicheMinDurationSec: Number(formData.get("nicheMinDurationSec") || 5),
      nicheMaxDurationSec: Number(formData.get("nicheMaxDurationSec") || 15),
    };

    const response = await fetch("/api/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      setLoading(false);
      setError(data.error || "Gagal memulai analisis.");
      return;
    }

    poll(data.analysisId);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <form action={onSubmit} className="rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1 block text-sm font-medium">URL YouTube</span>
            <input className="field" name="youtubeUrl" placeholder="https://www.youtube.com/watch?v=..." required />
          </label>

          {type === "LONG" && (
            <>
              <label>
                <span className="mb-1 block text-sm font-medium">Minimal Durasi Clip (menit)</span>
                <input className="field" name="minDurationMin" type="number" min="1" max="60" defaultValue="5" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Maksimal Durasi Clip (menit)</span>
                <input className="field" name="maxDurationMin" type="number" min="1" max="60" defaultValue="10" />
              </label>
              <input type="hidden" name="targetDuration" value="5" />
            </>
          )}

          <label>
            <span className="mb-1 block text-sm font-medium">Jumlah Minimal Video</span>
            <input className="field" name="minClipCount" type="number" min="1" max="20" defaultValue="5" />
          </label>

          {type === "SHORT" && (
            <>
              <label>
                <span className="mb-1 block text-sm font-medium">Min Durasi Shorts (detik)</span>
                <input className="field" name="minDurationSec" type="number" min="5" max="180" defaultValue="30" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Max Durasi Shorts (detik)</span>
                <input className="field" name="maxDurationSec" type="number" min="5" max="180" defaultValue="60" />
              </label>
            </>
          )}

          {type === "LONG" && (
            <>
              <label>
                <span className="mb-1 block text-sm font-medium">Minimal Hook/Niche Clip (detik)</span>
                <input className="field" name="nicheMinDurationSec" type="number" min="1" max="120" defaultValue="5" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Maksimal Hook/Niche Clip (detik)</span>
                <input className="field" name="nicheMaxDurationSec" type="number" min="1" max="180" defaultValue="15" />
              </label>
              <label>
                <span className="mb-1 block text-sm font-medium">Jumlah Hook/Teaser</span>
                <input className="field" name="hookCount" type="number" min="1" max="10" defaultValue="1" />
              </label>
            </>
          )}

          <label>
            <span className="mb-1 block text-sm font-medium">Preset Prompt Analisis</span>
            <select className="field" name="presetId" required>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-sm font-medium">Bahasa Subtitle</span>
            <select className="field" name="language" defaultValue="id">
              <option value="id">Indonesia</option>
              <option value="en">Inggris</option>
            </select>
          </label>
        </div>

        {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <button className="btn btn-primary mt-5" disabled={loading}>
          <Play size={16} />
          Analisis
        </button>
      </form>

      <div>{loading && <LoadingProgress progress={progress} text={progressText} status={status} />}</div>
    </div>
  );
}
