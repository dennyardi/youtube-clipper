import { TranscriptItem } from "@/lib/youtube";
import { secondsToClock } from "@/lib/time";

export type ClipCandidate = {
  id: string;
  start: number;
  end: number;
  duration: number;
  startText: string;
  endText: string;
  text: string;
  preview: string;
  score?: number;
  scoreDetails?: Record<string, unknown>;
};

function normalizeForPrompt(text: string, maxLength = 900) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}

export function buildClipCandidates(items: TranscriptItem[], minDuration: number, maxDuration: number): ClipCandidate[] {
  const candidates: ClipCandidate[] = [];
  const step = Math.max(1, Math.floor(items.length / 160));

  for (let startIndex = 0; startIndex < items.length; startIndex += step) {
    const start = items[startIndex].start;
    let endIndex = startIndex;
    let end = items[startIndex].end || start;

    while (endIndex < items.length && end - start < minDuration) {
      endIndex += 1;
      end = items[endIndex]?.end || end;
    }

    while (endIndex + 1 < items.length && items[endIndex + 1].end - start <= maxDuration) {
      endIndex += 1;
      end = items[endIndex].end || end;
    }

    const duration = end - start;
    if (duration < minDuration || duration > maxDuration + 2) continue;

    const text = items
      .slice(startIndex, endIndex + 1)
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 60) continue;

    candidates.push({
      id: `c${candidates.length + 1}`,
      start,
      end,
      duration,
      startText: secondsToClock(start),
      endText: secondsToClock(end),
      text,
      preview: normalizeForPrompt(text),
    });
  }

  return candidates.slice(0, 180);
}
