"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";

type Preset = { id: number; name: string; description: string | null; prompt: string };

export function PresetManager({ presets }: { presets: Preset[] }) {
  const [items, setItems] = useState(presets);

  async function createPreset(formData: FormData) {
    const response = await fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const data = await response.json();
    if (response.ok) setItems((current) => [...current, data]);
    else alert(data.error || "Gagal membuat preset.");
  }

  async function updatePreset(preset: Preset) {
    const response = await fetch(`/api/presets/${preset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preset),
    });
    const data = await response.json();
    if (response.ok) setItems((current) => current.map((item) => (item.id === preset.id ? data : item)));
    else alert(data.error || "Gagal menyimpan preset.");
  }

  async function deletePreset(id: number) {
    const response = await fetch(`/api/presets/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (response.ok) setItems((current) => current.filter((item) => item.id !== id));
    else alert(data.error || "Gagal menghapus preset.");
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <form action={createPreset} className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h2 className="mb-3 text-base font-semibold">Tambah Preset</h2>
        <div className="space-y-3">
          <input className="field" name="name" placeholder="Nama preset" required />
          <textarea className="field min-h-20" name="description" placeholder="Deskripsi" />
          <textarea className="field min-h-36" name="prompt" placeholder="Instruksi prompt untuk AI" required />
          <button className="btn btn-primary">
            <Plus size={16} />
            Tambah
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {items.map((preset) => (
          <div key={preset.id} className="rounded-lg border border-line bg-white p-5 shadow-soft">
            <div className="grid gap-3 md:grid-cols-2">
              <input className="field" value={preset.name} onChange={(event) => setItems((current) => current.map((item) => (item.id === preset.id ? { ...item, name: event.target.value } : item)))} />
              <input className="field" value={preset.description || ""} onChange={(event) => setItems((current) => current.map((item) => (item.id === preset.id ? { ...item, description: event.target.value } : item)))} />
            </div>
            <textarea className="field mt-3 min-h-28" value={preset.prompt} onChange={(event) => setItems((current) => current.map((item) => (item.id === preset.id ? { ...item, prompt: event.target.value } : item)))} />
            <div className="mt-3 flex gap-2">
              <button className="btn btn-muted" onClick={() => updatePreset(preset)}>
                <Save size={16} />
                Simpan
              </button>
              <button className="btn btn-danger" onClick={() => deletePreset(preset.id)}>
                <Trash2 size={16} />
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
