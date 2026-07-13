import fs from "node:fs/promises";
import type { ProviderMetadata } from "ai";

export const TRANSCRIPTION_MODEL =
  process.env.TRANSCRIPTION_MODEL ?? "openai/whisper-1";

export const TRANSCRIPTION_PROVIDER = "openai";

const GATEWAY_TRANSCRIPTION_URL =
  process.env.AI_GATEWAY_TRANSCRIPTION_URL ??
  "https://ai-gateway.vercel.sh/v4/ai/transcription-model";

export type TranscriptSegmentResult = {
  startSec: number;
  endSec: number;
  text: string;
};

export type TranscribeAudioResult = {
  text: string;
  language: string | null;
  durationInSeconds: number | null;
  segments: TranscriptSegmentResult[];
  costUsd: number;
};

const asObject = (value: unknown): Record<string, unknown> | undefined => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return undefined;
};

const readGatewayCostUsd = (
  payload: Record<string, unknown>,
): number | null => {
  const providerMetadata = asObject(payload.providerMetadata);
  const gateway = asObject(providerMetadata?.gateway);
  const rootGateway = asObject(payload.gateway);

  for (const source of [gateway, rootGateway, payload] as const) {
    if (!source) {
      continue;
    }

    for (const key of ["cost", "gatewayCost", "marketCost"] as const) {
      const raw = source[key];
      if (typeof raw === "number" && Number.isFinite(raw)) {
        return raw;
      }

      if (typeof raw === "string" && raw.length > 0) {
        const parsed = Number(raw);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }

  return null;
};

const parseSegments = (
  payload: Record<string, unknown>,
): TranscriptSegmentResult[] => {
  const rawSegments = payload.segments;
  if (!Array.isArray(rawSegments)) {
    return [];
  }

  const segments: TranscriptSegmentResult[] = [];
  for (const entry of rawSegments) {
    const row = asObject(entry);
    if (!row) {
      continue;
    }

    const text = typeof row.text === "string" ? row.text.trim() : "";
    const startSec =
      typeof row.start === "number"
        ? row.start
        : typeof row.startSec === "number"
          ? row.startSec
          : null;
    const endSec =
      typeof row.end === "number"
        ? row.end
        : typeof row.endSec === "number"
          ? row.endSec
          : null;

    if (!text || startSec === null || endSec === null) {
      continue;
    }

    segments.push({
      startSec,
      endSec,
      text,
    });
  }

  return segments;
};

/**
 * Transcribe via Vercel AI Gateway REST (base64 JSON).
 * Uses openai/whisper-1 with default segment timestamps from the provider.
 */
export const transcribeSpeechAudio = async (input: {
  filePath: string;
  mediaType?: string;
  prompt?: string;
}): Promise<TranscribeAudioResult> => {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is not set");
  }

  const audio = await fs.readFile(input.filePath);
  const providerOptions: Record<string, unknown> = {
    openai: {
      // Segment timestamps (default granularity); whisper-1 only.
      timestampGranularities: ["segment"],
      ...(input.prompt ? { prompt: input.prompt } : {}),
    },
  };

  const body: Record<string, unknown> = {
    audio: audio.toString("base64"),
    mediaType: input.mediaType ?? "audio/mpeg",
    providerOptions,
  };

  const response = await fetch(GATEWAY_TRANSCRIPTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "ai-model-id": TRANSCRIPTION_MODEL,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = asObject(await response.json().catch(() => null));
  if (!response.ok) {
    const message =
      (payload && typeof payload.message === "string" && payload.message) ||
      (payload && typeof payload.error === "string" && payload.error) ||
      `Gateway transcription failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!payload) {
    throw new Error("Gateway transcription returned an empty body");
  }

  const text = typeof payload.text === "string" ? payload.text : "";
  const segments = parseSegments(payload);
  const language =
    typeof payload.language === "string" ? payload.language : null;
  const durationInSeconds =
    typeof payload.durationInSeconds === "number"
      ? payload.durationInSeconds
      : null;

  const parsedCost = readGatewayCostUsd(payload);
  const costUsd = parsedCost ?? 0;
  if (parsedCost === null) {
    console.warn(
      "[transcribe] Gateway response missing cost metadata; recording ASR cost as $0",
    );
  }

  if (segments.length === 0 && text.trim().length > 0) {
    segments.push({
      startSec: 0,
      endSec: durationInSeconds ?? 0,
      text: text.trim(),
    });
  }

  console.log(
    `[transcribe] model=${TRANSCRIPTION_MODEL} bytes=${audio.byteLength} segments=${segments.length} cost=$${costUsd.toFixed(6)}`,
  );

  if (payload.providerMetadata) {
    console.log(
      `[transcribe] providerMetadata=${JSON.stringify(payload.providerMetadata as ProviderMetadata)}`,
    );
  }

  return {
    text,
    language,
    durationInSeconds,
    segments,
    costUsd,
  };
};
