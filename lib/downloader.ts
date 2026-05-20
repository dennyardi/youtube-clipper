import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { secondsToTimestamp } from "@/lib/time";

function runCommand(command: string, args: string[], timeoutMs = 20 * 60 * 1000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} timeout setelah ${Math.round(timeoutMs / 1000)} detik.`));
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
      if (code !== 0) reject(new Error(stderr || `${command} keluar dengan kode ${code}.`));
      else resolve();
    });
  });
}

export async function downloadClip(args: {
  clipId: string;
  youtubeUrl: string;
  startSecond: number;
  endSecond: number;
  mode?: "FAST" | "PRECISE";
  burnSubtitle?: boolean;
  subtitles?: Array<{ startSecond: number; endSecond: number; text: string }>;
  downloadQuality?: string;
}) {
  const ytdlp = process.env.YTDLP_EXE || "yt-dlp";
  const ffmpeg = process.env.FFMPEG_EXE || "ffmpeg";
  const ytdlpTimeoutMs = Number(process.env.YTDLP_TIMEOUT_MS || 20 * 60 * 1000);
  const ffmpegTimeoutMs = Number(process.env.FFMPEG_TIMEOUT_MS || 10 * 60 * 1000);
  const tmpDir = path.join(process.cwd(), "tmp");
  const downloadsDir = path.join(process.cwd(), "downloads");
  const startSecond = Math.max(0, args.startSecond);
  const endSecond = Math.max(startSecond + 1, args.endSecond);
  const duration = endSecond - startSecond;
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(downloadsDir, { recursive: true });

  const inputPath = path.join(tmpDir, `${args.clipId}.source.mp4`);
  const outputPath = path.join(downloadsDir, `${args.clipId}.mp4`);
  const ytdlpFormat = getYtdlpFormat(args.downloadQuality);
  const cookiesArgs = await getCookiesArgs();
  const jsRuntimeArgs = getJsRuntimeArgs();
  const remoteComponentArgs = getRemoteComponentArgs();
  await fs.rm(inputPath, { force: true });
  await fs.rm(outputPath, { force: true });

  await runCommand(
    ytdlp,
    [
      "-f",
      ytdlpFormat,
      "--no-playlist",
      "--no-part",
      "--socket-timeout",
      "30",
      "--retries",
      "2",
      "--fragment-retries",
      "2",
      ...cookiesArgs,
      ...jsRuntimeArgs,
      ...remoteComponentArgs,
      "--download-sections",
      `*${startSecond}-${endSecond}`,
      "--merge-output-format",
      "mp4",
      "-o",
      inputPath,
      args.youtubeUrl,
    ],
    ytdlpTimeoutMs,
  );

  const sourcePath = inputPath;
  if (!(await fileExists(sourcePath))) {
    const files = await fs.readdir(tmpDir);
    const matchingFiles = files.filter((file) => file.includes(args.clipId));
    throw new Error(`File hasil yt-dlp tidak ditemukan. File sementara terkait: ${matchingFiles.join(", ") || "tidak ada"}.`);
  }
  const precise = args.mode === "PRECISE" || args.burnSubtitle;
  let subtitlePath: string | null = null;
  let ffmpegArgs: string[];

  if (args.burnSubtitle && args.subtitles?.length) {
    subtitlePath = path.join(tmpDir, `${args.clipId}.srt`);
    await fs.writeFile(subtitlePath, buildSrt(args.subtitles, args.startSecond), "utf8");
  }

  if (precise) {
    ffmpegArgs = [
      "-y",
      "-ss",
      "0",
      "-to",
      String(duration),
      "-i",
      sourcePath,
      ...(subtitlePath ? ["-vf", `subtitles='${escapeSubtitlePath(subtitlePath)}'`] : []),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      outputPath,
    ];
  } else {
    ffmpegArgs = [
      "-y",
      "-ss",
      "0",
      "-to",
      String(duration),
      "-i",
      sourcePath,
      "-c",
      "copy",
      outputPath,
    ];
  }

  await runCommand(ffmpeg, ffmpegArgs, ffmpegTimeoutMs);

  await fs.rm(sourcePath, { force: true });
  if (subtitlePath) await fs.rm(subtitlePath, { force: true });
  return outputPath;
}

function buildSrt(segments: Array<{ startSecond: number; endSecond: number; text: string }>, clipStart: number) {
  return segments
    .map((segment, index) => {
      const start = Math.max(0, segment.startSecond - clipStart);
      const end = Math.max(start + 0.5, segment.endSecond - clipStart);
      return `${index + 1}\n${secondsToTimestamp(start).replace(".", ",")} --> ${secondsToTimestamp(end).replace(".", ",")}\n${segment.text}\n`;
    })
    .join("\n");
}

function escapeSubtitlePath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getCookiesArgs() {
  const cookiesFile = process.env.YTDLP_COOKIES_FILE?.trim();
  if (!cookiesFile) return [];
  if (!(await fileExists(cookiesFile))) {
    throw new Error(`File cookies yt-dlp tidak ditemukan: ${cookiesFile}`);
  }
  return ["--cookies", cookiesFile];
}

function getJsRuntimeArgs() {
  const runtime = process.env.YTDLP_JS_RUNTIME?.trim();
  return runtime ? ["--js-runtimes", runtime] : [];
}

function getRemoteComponentArgs() {
  const components = (process.env.YTDLP_REMOTE_COMPONENTS || "")
    .split(",")
    .map((component) => component.trim())
    .filter(Boolean);

  return components.flatMap((component) => ["--remote-components", component]);
}

function getYtdlpFormat(downloadQuality?: string) {
  const quality = String(downloadQuality || "360").trim();
  if (quality === "audio-video-best") return "bv*+ba/best";
  if (quality === "720") return formatForHeight(720);
  if (quality === "480") return formatForHeight(480);
  if (quality === "240") return formatForHeight(240);
  return formatForHeight(360);
}

function formatForHeight(height: number) {
  return [
    `bv*[height<=${height}][ext=mp4][vcodec^=avc1]+ba[ext=m4a]`,
    `b[height<=${height}][ext=mp4][vcodec^=avc1]`,
    `bv*[height<=${height}][ext=mp4]+ba[ext=m4a]`,
    `b[height<=${height}][ext=mp4]`,
    `best[height<=${height}]`,
    "best",
  ].join("/");
}
