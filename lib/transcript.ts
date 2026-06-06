import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fetchTranscriptViaApi, fetchVideoMetadata, fetchWithTimeout, pickCaptionTrack, TranscriptItem } from "@/lib/youtube";
import { secondsToTimestamp } from "@/lib/time";

function decodeHtml(text: string) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripTags(text: string) {
  return decodeHtml(String(text || "").replace(/<[^>]+>/g, ""));
}

export function parseTranscriptXml(xml: string): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  const regex = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let match;

  while ((match = regex.exec(xml))) {
    const attrText = match[1];
    const body = stripTags(match[2]).replace(/\s+/g, " ").trim();
    if (!body) continue;

    const start = Number((attrText.match(/\bstart="([^"]+)"/) || [])[1] || 0);
    const duration = Number((attrText.match(/\bdur="([^"]+)"/) || [])[1] || 0);
    items.push({ start, duration, end: start + duration, text: body });
  }

  return items;
}

export function parseTranscriptJson3(payload: string): TranscriptItem[] {
  const data = JSON.parse(payload);
  const events = Array.isArray(data?.events) ? data.events : [];

  return events
    .map((event: any) => {
      const segments = Array.isArray(event.segs) ? event.segs : [];
      const text = segments
        .map((segment: any) => segment.utf8 || "")
        .join("")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) return null;
      const start = Number(event.tStartMs || 0) / 1000;
      const duration = Number(event.dDurationMs || 0) / 1000;
      return { start, duration, end: start + duration, text };
    })
    .filter((item: TranscriptItem | null): item is TranscriptItem => Boolean(item));
}

async function fetchTranscriptViaPackage(videoId: string, language: string): Promise<TranscriptItem[]> {
  const { YoutubeTranscript } = await import("youtube-transcript");
  const rows = await YoutubeTranscript.fetchTranscript(videoId, { lang: language });

  return rows
    .map((row: any) => {
      const start = Number(row.offset || 0) / 1000;
      const duration = Number(row.duration || 0) / 1000;
      const text = String(row.text || "").replace(/\s+/g, " ").trim();
      if (!text) return null;
      return { start, duration, end: start + duration, text };
    })
    .filter((item: TranscriptItem | null): item is TranscriptItem => Boolean(item));
}

async function fetchTranscriptViaYtDlp(videoId: string, language: string): Promise<TranscriptItem[]> {
  const ytdlp = process.env.YTDLP_EXE || "yt-dlp";
  const tmpDir = path.join(process.cwd(), "tmp");
  const prefix = `subtitle-${videoId}-${randomUUID()}`;
  const outputTemplate = path.join(tmpDir, `${prefix}.%(ext)s`);
  const timeoutMs = Number(process.env.YTDLP_TIMEOUT_MS || 20 * 60 * 1000);
  const cookiesFile = process.env.YTDLP_COOKIES_FILE?.trim();
  const jsRuntime = process.env.YTDLP_JS_RUNTIME?.trim();
  const remoteComponents = (process.env.YTDLP_REMOTE_COMPONENTS || "")
    .split(",")
    .map((component) => component.trim())
    .filter(Boolean);

  await fs.mkdir(tmpDir, { recursive: true });

  const args = [
    "--no-playlist",
    "--skip-download",
    "--write-subs",
    "--write-auto-subs",
    "--sub-langs",
    `${language},${language}.*`,
    "--sub-format",
    "json3",
    ...(cookiesFile ? ["--cookies", cookiesFile] : []),
    ...(jsRuntime ? ["--js-runtimes", jsRuntime] : []),
    ...remoteComponents.flatMap((component) => ["--remote-components", component]),
    "-o",
    outputTemplate,
    `https://www.youtube.com/watch?v=${videoId}`,
  ];

  try {
    await runYtDlp(ytdlp, args, timeoutMs);
    const files = (await fs.readdir(tmpDir)).filter((file) => file.startsWith(prefix) && file.endsWith(".json3"));
    for (const file of files) {
      const items = parseTranscriptJson3(await fs.readFile(path.join(tmpDir, file), "utf8"));
      if (items.length) return items;
    }
    return [];
  } finally {
    const files = await fs.readdir(tmpDir).catch(() => []);
    await Promise.all(
      files
        .filter((file) => file.startsWith(prefix))
        .map((file) => fs.rm(path.join(tmpDir, file), { force: true })),
    );
  }
}

function runYtDlp(command: string, args: string[], timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} subtitle timeout setelah ${Math.round(timeoutMs / 1000)} detik.`));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${command} keluar dengan kode ${code}.`));
    });
  });
}

export function transcriptToText(items: TranscriptItem[]) {
  return items.map((item) => `[${secondsToTimestamp(item.start)} - ${secondsToTimestamp(item.end)}] ${item.text}`).join("\n");
}

export async function getTranscript({ videoId, language }: { videoId: string; language: string }) {
  if (!["id", "en"].includes(language)) throw new Error("Pilihan bahasa tidak valid.");

  const metadata = await fetchVideoMetadata(videoId);
  if (!metadata.captions.length) {
    try {
      const fallbackItems = await fetchTranscriptViaYtDlp(videoId, language);
      if (fallbackItems.length) {
        return {
          videoId,
          title: metadata.title,
          languageCode: language,
          languageName: language === "id" ? "Indonesia" : "English",
          isAutoGenerated: true,
          itemCount: fallbackItems.length,
          items: fallbackItems,
          text: transcriptToText(fallbackItems),
        };
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Subtitle tidak terdeteksi dari metadata YouTube dan fallback yt-dlp gagal: ${detail}`);
    }
    throw new Error(`Subtitle bahasa ${language === "id" ? "Indonesia" : "English"} tidak ditemukan oleh YouTube maupun yt-dlp.`);
  }

  const track = pickCaptionTrack(metadata.captions, language);
  if (!track) {
    try {
      const fallbackItems = await fetchTranscriptViaYtDlp(videoId, language);
      if (fallbackItems.length) {
        return {
          videoId,
          title: metadata.title,
          languageCode: language,
          languageName: language === "id" ? "Indonesia" : "English",
          isAutoGenerated: true,
          itemCount: fallbackItems.length,
          items: fallbackItems,
          text: transcriptToText(fallbackItems),
        };
      }
    } catch {
      // Continue with the more useful list of languages reported by YouTube.
    }
    const available = metadata.captions
      .map((caption) => `${caption.languageCode}${caption.name?.simpleText ? ` (${caption.name.simpleText})` : ""}`)
      .join(", ");
    throw new Error(`Subtitle bahasa ${language === "id" ? "Indonesia" : "English"} tidak tersedia. Bahasa tersedia: ${available || "tidak diketahui"}.`);
  }

  const transcriptUrl = new URL(track.baseUrl);
  transcriptUrl.searchParams.set("fmt", "json3");

  const response = await fetchWithTimeout(transcriptUrl.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    },
  });

  if (!response.ok) throw new Error(`Gagal mengambil subtitle. Status ${response.status}.`);

  const body = await response.text();
  let items: TranscriptItem[] = [];
  try {
    items = parseTranscriptJson3(body);
  } catch {
    items = parseTranscriptXml(body);
  }

  if (!items.length) {
    try {
      items = await fetchTranscriptViaPackage(videoId, track.languageCode || language);
    } catch {
      items = await fetchTranscriptViaApi(videoId, track.languageCode || language, metadata.visitorData);
    }
  }

  if (!items.length) throw new Error("Subtitle ditemukan, tetapi isinya kosong atau tidak bisa diproses.");

  return {
    videoId,
    title: metadata.title,
    languageCode: track.languageCode,
    languageName: track.nameText || track.languageCode,
    isAutoGenerated: track.kind === "asr",
    itemCount: items.length,
    items,
    text: transcriptToText(items),
  };
}
