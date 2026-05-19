"use client";

import { useState } from "react";
import { Save } from "lucide-react";

type Setting = {
  openaiModel: string;
  analysisMode: "HYBRID" | "FULL_AI";
  maxAiCandidates: number;
  downloadQuality: string;
  apiKeySource: string;
};

export function SettingsForm({ setting }: { setting: Setting }) {
  const [form, setForm] = useState(setting);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setMessage(null);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, openaiApiKey }),
    });
    const data = await response.json();
    if (response.ok) {
      setForm({ ...form, ...data });
      setOpenaiApiKey("");
      setMessage("Setting berhasil disimpan.");
    } else {
      setMessage(data.error || "Gagal menyimpan setting.");
    }
  }

  return (
    <div className="max-w-3xl rounded-lg border border-line bg-white p-6 shadow-soft">
      <div className="mb-4 rounded-md border border-line bg-panel px-3 py-2 text-sm">
        OpenAI API Key aktif: <span className="font-medium">{form.apiKeySource}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium">OpenAI API Key</span>
          <input
            className="field"
            type="password"
            value={openaiApiKey}
            onChange={(event) => setOpenaiApiKey(event.target.value)}
            placeholder="Isi API key baru, kosongkan jika tidak ingin mengubah"
          />
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium">Model ChatGPT</span>
          <select className="field" value={form.openaiModel} onChange={(event) => setForm({ ...form, openaiModel: event.target.value })}>
            <option value="gpt-5.2">gpt-5.2</option>
            <option value="gpt-5.2-mini">gpt-5.2-mini</option>
            <option value="gpt-5.1">gpt-5.1</option>
            <option value="gpt-4.1">gpt-4.1</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium">Mode Analisis</span>
          <select className="field" value={form.analysisMode} onChange={(event) => setForm({ ...form, analysisMode: event.target.value as Setting["analysisMode"] })}>
            <option value="HYBRID">Hybrid Python + AI</option>
            <option value="FULL_AI">Full AI</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium">Maks Kandidat AI</span>
          <input
            className="field"
            type="number"
            min="5"
            max="100"
            value={form.maxAiCandidates}
            onChange={(event) => setForm({ ...form, maxAiCandidates: Number(event.target.value) })}
          />
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium">Resolusi Download</span>
          <select className="field" value={form.downloadQuality} onChange={(event) => setForm({ ...form, downloadQuality: event.target.value })}>
            <option value="240">240p - paling ringan</option>
            <option value="360">360p - rekomendasi video panjang</option>
            <option value="480">480p - seimbang</option>
            <option value="720">720p - lebih tajam</option>
            <option value="audio-video-best">Best available - paling berat</option>
          </select>
          <span className="mt-1 block text-xs text-muted">Untuk clip 30 menit ke atas, 360p biasanya paling aman agar VPS tidak penuh dan tidak timeout.</span>
        </label>
      </div>

      {message && <div className="mt-4 rounded-md border border-line bg-panel px-3 py-2 text-sm">{message}</div>}

      <button className="btn btn-primary mt-5" onClick={save}>
        <Save size={16} />
        Simpan Setting
      </button>
    </div>
  );
}
