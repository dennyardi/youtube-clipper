import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { secondsToTimestamp } from "@/lib/time";

function runCommand(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
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
}) {
  const ytdlp = process.env.YTDLP_EXE || "yt-dlp";
  const ffmpeg = process.env.FFMPEG_EXE || "ffmpeg";
  const tmpDir = path.join(process.cwd(), "tmp");
  const downloadsDir = path.join(process.cwd(), "downloads");
  await fs.mkdir(tmpDir, { recursive: true });
  await fs.mkdir(downloadsDir, { recursive: true });

  const inputPath = path.join(tmpDir, `${args.clipId}.source.%(ext)s`);
  const outputPath = path.join(downloadsDir, `${args.clipId}.mp4`);

  await runCommand(ytdlp, [
    "-f",
    "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "-o",
    inputPath,
    args.youtubeUrl,
  ]);

  const files = await fs.readdir(tmpDir);
  const sourceName = files.find((file) => file.startsWith(`${args.clipId}.source.`));
  if (!sourceName) throw new Error("File hasil yt-dlp tidak ditemukan.");

  const sourcePath = path.join(tmpDir, sourceName);
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
      String(Math.max(0, args.startSecond)),
      "-to",
      String(Math.max(args.startSecond, args.endSecond)),
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
      String(Math.max(0, args.startSecond)),
      "-to",
      String(Math.max(args.startSecond, args.endSecond)),
      "-i",
      sourcePath,
      "-c",
      "copy",
      outputPath,
    ];
  }

  await runCommand(ffmpeg, ffmpegArgs);

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
