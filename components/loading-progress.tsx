"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export function LoadingProgress({
  progress,
  text,
  status,
}: {
  progress: number;
  text?: string | null;
  status?: string;
}) {
  const done = status === "COMPLETED";
  const failed = status === "FAILED";

  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {done ? <CheckCircle2 size={18} className="text-green-600" /> : failed ? <XCircle size={18} className="text-red-600" /> : <Loader2 size={18} className="animate-spin text-brand" />}
          {text || "Menunggu proses..."}
        </div>
        <span className="text-sm font-semibold">{progress}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
    </div>
  );
}
