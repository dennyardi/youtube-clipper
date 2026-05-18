import path from "node:path";
import { spawn } from "node:child_process";
import { ClipCandidate } from "@/lib/candidates";

export function runPythonScorer(payload: {
  clips: ClipCandidate[];
  language: string;
  preset: string;
  minDuration: number;
  maxDuration: number;
  limit: number;
}): Promise<{ clips: ClipCandidate[] }> {
  return new Promise((resolve, reject) => {
    const pythonExe = process.env.PYTHON_EXE || "python";
    const scorerPath = path.join(process.cwd(), "python", "scorer.py");
    const child = spawn(pythonExe, [scorerPath], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(new Error(`Gagal menjalankan Python scorer: ${error.message}`));
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Python scorer keluar dengan kode ${code}.`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Output Python scorer tidak valid."));
      }
    });

    child.stdin.end(JSON.stringify(payload));
  });
}
