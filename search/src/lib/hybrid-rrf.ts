import {
  searchHybridEmbeddingsByModality,
  type HybridModalitySearchRow,
} from "db/access/hybrid/hybrid-search.js";
import {
  HYBRID_MODALITIES,
  type HybridModality,
} from "db/access/hybrid/hybrid-embeddings.js";

export type HybridModalityWeights = {
  video: number;
  speech: number;
  vision: number;
};

export type HybridRrfSearchHit = {
  segmentId: string;
  fileId: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  filename: string;
  collectionId: string;
  sourceStorageKey: string | null;
  sourceStorageBucket: string;
  rrfScore: number;
  ranks: {
    video?: number;
    speech?: number;
    vision?: number;
  };
  sources: HybridModality[];
  text: string | null;
  visionTimestampSec: number | null;
  visionStoreKey: string | null;
};

export type SearchHybridRrfInput = {
  embedding: number[];
  uploadId?: string;
  collectionIds?: string[];
  limit?: number;
  perModalityLimit?: number;
  weights?: Partial<HybridModalityWeights>;
  rrfK?: number;
};

const DEFAULT_WEIGHTS: HybridModalityWeights = {
  video: 1,
  speech: 1,
  vision: 1,
};

const DEFAULT_RRF_K = 60;
const DEFAULT_LIMIT = 10;

const fuseKey = (fileId: string, segmentIndex: number) =>
  `${fileId}:${segmentIndex}`;

type AccHit = {
  segmentId: string;
  fileId: string;
  segmentIndex: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  filename: string;
  collectionId: string;
  sourceStorageKey: string | null;
  sourceStorageBucket: string;
  rrfScore: number;
  ranks: {
    video?: number;
    speech?: number;
    vision?: number;
  };
  sources: Set<HybridModality>;
  text: string | null;
  visionTimestampSec: number | null;
  visionStoreKey: string | null;
};

/** Weighted RRF over parallel per-modality cosine top-K lists. */
export const fuseHybridModalityRanks = (
  modalityHits: Partial<Record<HybridModality, HybridModalitySearchRow[]>>,
  weights: HybridModalityWeights,
  rrfK: number,
  limit: number,
): HybridRrfSearchHit[] => {
  const acc = new Map<string, AccHit>();

  for (const modality of HYBRID_MODALITIES) {
    const weight = weights[modality];
    if (!(weight > 0)) {
      continue;
    }

    const rows = modalityHits[modality] ?? [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rank = i + 1;
      const key = fuseKey(row.fileId, row.segmentIndex);
      const existing = acc.get(key);

      if (!existing) {
        acc.set(key, {
          segmentId: row.segmentId,
          fileId: row.fileId,
          segmentIndex: row.segmentIndex,
          startSec: row.startSec,
          endSec: row.endSec,
          durationSec: row.durationSec,
          filename: row.filename,
          collectionId: row.collectionId,
          sourceStorageKey: row.sourceStorageKey,
          sourceStorageBucket: row.sourceStorageBucket,
          rrfScore: weight / (rrfK + rank),
          ranks: { [modality]: rank },
          sources: new Set([modality]),
          text: modality === "speech" ? row.text : null,
          visionTimestampSec:
            modality === "vision" ? row.timestampSec : null,
          visionStoreKey: modality === "vision" ? row.storeKey : null,
        });
        continue;
      }

      existing.rrfScore += weight / (rrfK + rank);
      existing.ranks[modality] = rank;
      existing.sources.add(modality);
      if (modality === "speech" && row.text) {
        existing.text = row.text;
      }
      if (modality === "vision") {
        existing.visionTimestampSec = row.timestampSec;
        existing.visionStoreKey = row.storeKey;
      }
    }
  }

  return [...acc.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit)
    .map((hit) => ({
      segmentId: hit.segmentId,
      fileId: hit.fileId,
      segmentIndex: hit.segmentIndex,
      startSec: hit.startSec,
      endSec: hit.endSec,
      durationSec: hit.durationSec,
      filename: hit.filename,
      collectionId: hit.collectionId,
      sourceStorageKey: hit.sourceStorageKey,
      sourceStorageBucket: hit.sourceStorageBucket,
      rrfScore: hit.rrfScore,
      ranks: hit.ranks,
      sources: HYBRID_MODALITIES.filter((modality) =>
        hit.sources.has(modality),
      ),
      text: hit.text,
      visionTimestampSec: hit.visionTimestampSec,
      visionStoreKey: hit.visionStoreKey,
    }));
};

export const searchHybridRrf = async (
  input: SearchHybridRrfInput,
): Promise<HybridRrfSearchHit[]> => {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const perModalityLimit =
    input.perModalityLimit ?? Math.max(limit * 3, 20);
  const rrfK = input.rrfK ?? DEFAULT_RRF_K;
  const weights: HybridModalityWeights = {
    video: input.weights?.video ?? DEFAULT_WEIGHTS.video,
    speech: input.weights?.speech ?? DEFAULT_WEIGHTS.speech,
    vision: input.weights?.vision ?? DEFAULT_WEIGHTS.vision,
  };

  const activeModalities = HYBRID_MODALITIES.filter(
    (modality) => weights[modality] > 0,
  );

  if (activeModalities.length === 0) {
    return [];
  }

  const modalityHits = Object.fromEntries(
    await Promise.all(
      activeModalities.map(async (modality) => {
        const rows = await searchHybridEmbeddingsByModality({
          embedding: input.embedding,
          uploadId: input.uploadId,
          collectionIds: input.collectionIds,
          limit: perModalityLimit,
          modality,
        });
        return [modality, rows] as const;
      }),
    ),
  ) as Partial<Record<HybridModality, HybridModalitySearchRow[]>>;

  return fuseHybridModalityRanks(modalityHits, weights, rrfK, limit);
};
