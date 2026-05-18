import { AnalysisType } from "@prisma/client";
import { ClipCandidate } from "@/lib/candidates";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { fetchWithTimeout } from "@/lib/youtube";

const OPENAI_TIMEOUT_MS = 90_000;

type AiClip = {
  title: string;
  caption?: string | null;
  hashtags?: string[] | null;
  reason: string;
  startSecond: number;
  endSecond: number;
  hookStartSecond?: number | null;
  hookEndSecond?: number | null;
  hookReason?: string | null;
  hooks?: Array<{
    title?: string | null;
    reason?: string | null;
    startSecond: number;
    endSecond: number;
  }>;
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["nicheAnalysis", "clips"],
  properties: {
    nicheAnalysis: { type: "string" },
    clips: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "caption", "hashtags", "reason", "startSecond", "endSecond", "hookStartSecond", "hookEndSecond", "hookReason", "hooks"],
        properties: {
          title: { type: "string" },
          caption: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
          startSecond: { type: "number" },
          endSecond: { type: "number" },
          hookStartSecond: { type: ["number", "null"] },
          hookEndSecond: { type: ["number", "null"] },
          hookReason: { type: ["string", "null"] },
          hooks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "reason", "startSecond", "endSecond"],
              properties: {
                title: { type: ["string", "null"] },
                reason: { type: ["string", "null"] },
                startSecond: { type: "number" },
                endSecond: { type: "number" },
              },
            },
          },
        },
      },
    },
  },
};

function candidateText(candidates: ClipCandidate[]) {
  return candidates
    .map((candidate) =>
      [
        `ID: ${candidate.id}`,
        `Time: ${candidate.startText}-${candidate.endText} (${Math.round(candidate.duration)}s)`,
        `Seconds: ${Math.round(candidate.start)}-${Math.round(candidate.end)}`,
        `Python score: ${candidate.score ?? "-"}`,
        `Transcript: ${candidate.preview}`,
      ].join("\n"),
    )
    .join("\n\n");
}

function fullTranscriptChunks(transcriptText: string, maxChars = 15_000) {
  const chunks: string[] = [];
  for (let index = 0; index < transcriptText.length; index += maxChars) {
    chunks.push(transcriptText.slice(index, index + maxChars));
  }
  return chunks.slice(0, 8);
}

const boundaryRules = [
  "ATURAN CUT TIME WAJIB:",
  "1. Start time harus berada di awal pembicaraan, awal kalimat, awal jawaban, atau awal topik. Jangan mulai saat pembicara sedang berada di tengah kalimat.",
  "2. Hindari start time tepat setelah kata sambung atau potongan frasa seperti: dan, tapi, kalau, karena, yang, jadi, terus, kemudian, maka, bahwa, atau, namun, lalu.",
  "3. End time harus berada setelah konteks pembahasan selesai secara natural. Jangan berhenti sebelum jawaban, punchline, kesimpulan, atau penjelasan utamanya selesai.",
  "4. Jangan end time tepat setelah kata sambung, jeda menggantung, atau kalimat yang masih membutuhkan lanjutan.",
  "5. Lebih baik mundurkan start beberapa detik ke awal kalimat daripada memulai tepat di momen tengah obrolan.",
  "6. Lebih baik majukan end beberapa detik sampai konteks utuh selesai, selama masih berada dalam batas durasi yang diminta.",
  "7. Clip harus terasa utuh saat ditonton tanpa konteks video penuh.",
  "8. Jangan memilih bagian yang hanya menarik karena satu kalimat pendek tetapi setup atau penutupnya hilang.",
  "9. Wajib patuhi durasi minimal dan maksimal. Jangan pernah membuat endSecond-startSecond di luar range durasi.",
].join("\n");

async function callOpenAI(prompt: string, model: string) {
  const setting = await prisma.setting.findUnique({ where: { id: 1 } });
  const apiKey = decryptSecret(setting?.openaiApiKeyEnc) || process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-your-key-here") {
    throw new Error("OpenAI API Key belum diisi. Masukkan di halaman Setting atau file .env.");
  }

  const response = await fetchWithTimeout(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
        text: {
          format: {
            type: "json_schema",
            name: "clip_analysis",
            strict: true,
            schema: responseSchema,
          },
        },
      }),
    },
    OPENAI_TIMEOUT_MS,
  );

  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message || `OpenAI API mengembalikan status ${response.status}.`);

  const outputText =
    json.output_text ||
    json.output
      ?.flatMap((item: any) => item.content || [])
      .map((content: any) => content.text || "")
      .join("")
      .trim();

  if (!outputText) throw new Error("OpenAI tidak mengembalikan hasil analisis.");
  return JSON.parse(outputText) as { nicheAnalysis: string; clips: AiClip[] };
}

export async function analyzeHybridWithAI(args: {
  model: string;
  type: AnalysisType;
  videoTitle: string;
  presetName: string;
  presetPrompt: string;
  targetDuration: number;
  minClipCount: number;
  hookCount: number;
  minDuration: number;
  maxDuration: number;
  nicheFocus?: string | null;
  nicheMinDuration?: number | null;
  nicheMaxDuration?: number | null;
  candidates: ClipCandidate[];
}) {
  const isLong = args.type === "LONG";
  const prompt = [
    "Kamu adalah analis video YouTube profesional untuk membuat clip dari transcript.",
    "Gunakan hanya rentang waktu dari kandidat yang diberikan. Jangan membuat timestamp di luar rentang kandidat.",
    "Jika kandidat terasa mulai di tengah kalimat atau berhenti menggantung, pilih kandidat lain yang lebih utuh.",
    `Video: ${args.videoTitle}`,
    `Preset: ${args.presetName}`,
    `Instruksi preset: ${args.presetPrompt}`,
    `Jumlah minimal clip: ${args.minClipCount}`,
    boundaryRules,
    isLong
      ? `Tipe: Long Video. Durasi clip harus berada di range ${Math.round(args.minDuration / 60)}-${Math.round(args.maxDuration / 60)} menit. Tentukan hook/teaser menarik dari dalam clip untuk diletakkan di awal.`
      : `Tipe: Shorts. Durasi harus ${args.minDuration}-${args.maxDuration} detik. Tidak perlu hook terpisah.`,
    isLong ? `Jumlah hook/teaser yang diminta untuk setiap clip: ${args.hookCount}. Isi array hooks sebanyak mungkin sesuai jumlah tersebut dari dalam rentang clip utama.` : "Untuk Shorts, isi hooks sebagai array kosong.",
    isLong && args.nicheFocus ? `Preferensi niche/audience tambahan: ${args.nicheFocus}` : "",
    isLong && args.nicheMinDuration && args.nicheMaxDuration
      ? `Hook/teaser ideal berada di range ${args.nicheMinDuration}-${args.nicheMaxDuration} detik.`
      : "",
    "Isi nicheAnalysis berdasarkan preset analisis yang dipilih: ringkas niche video, target penonton, angle konten, dan alasan kenapa clip yang dipilih cocok untuk niche tersebut.",
    "Untuk setiap clip, buat title yang kuat, caption siap posting, dan 5-10 hashtags relevan tanpa tanda baca aneh.",
    "Return JSON valid saja sesuai schema.",
    "",
    "KANDIDAT:",
    candidateText(args.candidates),
  ].join("\n");

  return callOpenAI(prompt, args.model);
}

export async function analyzeFullTranscriptWithAI(args: {
  model: string;
  type: AnalysisType;
  videoTitle: string;
  presetName: string;
  presetPrompt: string;
  targetDuration: number;
  minClipCount: number;
  hookCount: number;
  minDuration: number;
  maxDuration: number;
  nicheFocus?: string | null;
  nicheMinDuration?: number | null;
  nicheMaxDuration?: number | null;
  transcriptText: string;
}) {
  const chunks = fullTranscriptChunks(args.transcriptText);
  const isLong = args.type === "LONG";
  const prompt = [
    "Kamu adalah analis video YouTube profesional. Analisis transcript bertimestamp dan pilih bagian terbaik untuk dijadikan clip.",
    "Pilih timestamp hanya dari transcript. Hindari memotong di tengah konteks jika memungkinkan.",
    "Timestamp harus mengikuti batas kalimat/topik pada transcript, bukan sekadar mengejar durasi.",
    `Video: ${args.videoTitle}`,
    `Preset: ${args.presetName}`,
    `Instruksi preset: ${args.presetPrompt}`,
    `Jumlah minimal clip: ${args.minClipCount}`,
    boundaryRules,
    isLong
      ? `Tipe: Long Video. Durasi clip harus berada di range ${Math.round(args.minDuration / 60)}-${Math.round(args.maxDuration / 60)} menit. Tentukan hook/teaser menarik untuk awal video.`
      : `Tipe: Shorts. Durasi harus ${args.minDuration}-${args.maxDuration} detik. Tidak perlu hook terpisah.`,
    isLong ? `Jumlah hook/teaser yang diminta untuk setiap clip: ${args.hookCount}. Isi array hooks sebanyak mungkin sesuai jumlah tersebut dari dalam rentang clip utama.` : "Untuk Shorts, isi hooks sebagai array kosong.",
    isLong && args.nicheFocus ? `Preferensi niche/audience tambahan: ${args.nicheFocus}` : "",
    isLong && args.nicheMinDuration && args.nicheMaxDuration
      ? `Hook/teaser ideal berada di range ${args.nicheMinDuration}-${args.nicheMaxDuration} detik.`
      : "",
    "Isi nicheAnalysis berdasarkan preset analisis yang dipilih: ringkas niche video, target penonton, angle konten, dan alasan kenapa clip yang dipilih cocok untuk niche tersebut.",
    "Untuk setiap clip, buat title yang kuat, caption siap posting, dan 5-10 hashtags relevan tanpa tanda baca aneh.",
    "Return JSON valid saja sesuai schema.",
    "",
    "TRANSCRIPT:",
    chunks.join("\n\n--- CHUNK ---\n\n"),
  ].join("\n");

  return callOpenAI(prompt, args.model);
}
