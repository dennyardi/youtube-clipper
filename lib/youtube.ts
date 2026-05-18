const YOUTUBE_TIMEOUT_MS = 12_000;
const ANDROID_CLIENT_VERSION = "19.29.37";
const ANDROID_USER_AGENT = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 11) gzip`;

type CaptionTrack = {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> };
};

export type TranscriptItem = {
  start: number;
  duration: number;
  end: number;
  text: string;
};

export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = YOUTUBE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request terlalu lama. Coba lagi atau gunakan video lain.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractVideoId(input: string) {
  const value = String(input || "").trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Link YouTube tidak valid.");
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
  }

  if (host.endsWith("youtube.com")) {
    const id = url.searchParams.get("v");
    if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;

    const parts = url.pathname.split("/").filter(Boolean);
    const videoIndex = parts.findIndex((part) => ["shorts", "embed", "live"].includes(part));
    if (videoIndex >= 0 && /^[a-zA-Z0-9_-]{11}$/.test(parts[videoIndex + 1])) {
      return parts[videoIndex + 1];
    }
  }

  throw new Error("Tidak bisa menemukan ID video dari link tersebut.");
}

function encodeVarint(value: number) {
  const bytes: number[] = [];
  let current = value;
  while (current > 0x7f) {
    bytes.push((current & 0x7f) | 0x80);
    current >>>= 7;
  }
  bytes.push(current);
  return bytes;
}

function buildTranscriptParams(videoId: string, language: string) {
  const innerParts = [
    0x0a,
    0x03,
    ...Buffer.from("asr"),
    0x12,
    ...encodeVarint(language.length),
    ...Buffer.from(language),
    0x1a,
    0x00,
  ];
  const innerEncoded = encodeURIComponent(Buffer.from(innerParts).toString("base64"));
  const panelName = "engagement-panel-searchable-transcript-search-panel";
  const outerParts = [
    0x0a,
    ...encodeVarint(videoId.length),
    ...Buffer.from(videoId),
    0x12,
    ...encodeVarint(innerEncoded.length),
    ...Buffer.from(innerEncoded),
    0x18,
    0x01,
    0x2a,
    ...encodeVarint(panelName.length),
    ...Buffer.from(panelName),
    0x30,
    0x01,
    0x38,
    0x01,
    0x40,
    0x01,
  ];
  return Buffer.from(outerParts).toString("base64");
}

function findBalancedJson(source: string, marker: string) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return null;

  const start = source.indexOf("{", markerIndex);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }

  return null;
}

export async function fetchVideoMetadata(videoId: string) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
  const response = await fetchWithTimeout(watchUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
    },
  });

  if (!response.ok) throw new Error(`YouTube mengembalikan status ${response.status}.`);

  const html = await response.text();
  const jsonText = findBalancedJson(html, "ytInitialPlayerResponse");
  if (!jsonText) throw new Error("Tidak bisa membaca metadata video dari YouTube.");

  const player = JSON.parse(jsonText);
  const visitorData =
    (html.match(/"visitorData":"([^"]+)"/) || [])[1] ||
    (html.match(/"VISITOR_DATA":"([^"]+)"/) || [])[1] ||
    "";

  return {
    title: player?.videoDetails?.title || videoId,
    visitorData,
    captions: (player?.captions?.playerCaptionsTracklistRenderer?.captionTracks || []) as CaptionTrack[],
  };
}

export function pickCaptionTrack(tracks: CaptionTrack[], language: string) {
  const requested = language === "id" ? ["id", "id-id"] : ["en", "en-us", "en-gb"];
  const normalized = tracks.map((track) => ({
    ...track,
    languageCode: String(track.languageCode || "").toLowerCase(),
    nameText: track.name?.simpleText || track.name?.runs?.map((run) => run.text).join("") || "",
  }));

  const exact = normalized.find((track) => requested.includes(track.languageCode));
  if (exact) return exact;

  const prefix = normalized.find((track) => requested.some((code) => track.languageCode.startsWith(`${code}-`)));
  if (prefix) return prefix;

  return null;
}

export function parseTranscriptApiSegments(json: any): TranscriptItem[] {
  const webSegments = json?.actions?.[0]?.updateEngagementPanelAction?.content
    ?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body
    ?.transcriptSegmentListRenderer?.initialSegments;

  const androidSegments = json?.actions?.[0]?.elementsCommand?.transformEntityCommand
    ?.arguments?.transformTranscriptSegmentListArguments?.overwrite?.initialSegments;

  const segments = webSegments || androidSegments || [];
  return segments
    .filter((segment: any) => segment?.transcriptSegmentRenderer)
    .map((segment: any) => {
      const renderer = segment.transcriptSegmentRenderer;
      const webText = renderer?.snippet?.runs?.map((run: any) => run.text || "").join("");
      const androidText = renderer?.snippet?.elementsAttributedString?.content;
      const text = (webText || androidText || "").replace(/\s+/g, " ").trim();
      const start = Number(renderer?.startMs || 0) / 1000;
      const end = Number(renderer?.endMs || 0) / 1000;
      if (!text) return null;
      return { start, duration: Math.max(0, end - start), end: end || start + 2, text };
    })
    .filter(Boolean);
}

export async function fetchTranscriptViaApi(videoId: string, language: string, visitorData: string) {
  const params = buildTranscriptParams(videoId, language);
  const payload = JSON.stringify({
    context: {
      client: {
        hl: language,
        gl: "US",
        clientName: "ANDROID",
        clientVersion: ANDROID_CLIENT_VERSION,
        androidSdkVersion: 30,
        visitorData,
      },
    },
    params,
  });

  const response = await fetchWithTimeout("https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload).toString(),
      "User-Agent": ANDROID_USER_AGENT,
      Origin: "https://www.youtube.com",
    },
    body: payload,
  });

  if (!response.ok) throw new Error(`Endpoint transcript mengembalikan status ${response.status}.`);
  const json = await response.json();
  if (json.error) throw new Error(json.error.message || "Endpoint transcript YouTube menolak request.");
  return parseTranscriptApiSegments(json);
}
