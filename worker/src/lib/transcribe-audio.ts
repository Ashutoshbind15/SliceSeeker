import fs from "node:fs/promises";
import {
  experimental_transcribe as transcribe,
  gateway,
  type ProviderMetadata,
} from "ai";
import { getGatewayCostUsd } from "./embed-usage.js";

export const TRANSCRIPTION_MODEL =
  process.env.TRANSCRIPTION_MODEL ?? "openai/whisper-1";

export const TRANSCRIPTION_PROVIDER = "openai";

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

/**
 * Transcribe via AI SDK + AI Gateway (`openai/whisper-1`, segment timestamps).
 */
export const transcribeSpeechAudio = async (input: {
  filePath: string;
  mediaType?: string;
  prompt?: string;
}): Promise<TranscribeAudioResult> => {
  const audio = await fs.readFile(input.filePath);

  const result = await transcribe({
    model: gateway.transcriptionModel(TRANSCRIPTION_MODEL),
    audio,
    providerOptions: {
      openai: {
        timestampGranularities: ["segment"],
        ...(input.prompt ? { prompt: input.prompt } : {}),
      },
    },
  });

  const segments: TranscriptSegmentResult[] = result.segments
    .map((segment) => ({
      startSec: segment.startSecond,
      endSec: segment.endSecond,
      text: segment.text.trim(),
    }))
    .filter((segment) => segment.text.length > 0);

  if (segments.length === 0 && result.text.trim().length > 0) {
    segments.push({
      startSec: 0,
      endSec: result.durationInSeconds ?? 0,
      text: result.text.trim(),
    });
  }

  const costUsd = getGatewayCostUsd(
    result.providerMetadata as ProviderMetadata | undefined,
  );

  console.log(
    `[transcribe] model=${TRANSCRIPTION_MODEL} bytes=${audio.byteLength} segments=${segments.length} cost=$${costUsd.toFixed(6)}`,
  );

  if (result.providerMetadata) {
    console.log(
      `[transcribe] providerMetadata=${JSON.stringify(result.providerMetadata)}`,
    );
  }

  return {
    text: result.text,
    language: result.language ?? null,
    durationInSeconds: result.durationInSeconds ?? null,
    segments,
    costUsd,
  };
};
