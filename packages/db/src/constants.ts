export const getEmbeddingModel = () =>
  process.env.EMBEDDING_MODEL ?? "google/gemini-embedding-2";
