/**
 * Phase 1 will fan out video / speech / vision jobs per media_segments row.
 * Phase 0 only needs the hook so the segmenter can call it after commit.
 */
export const enqueueHybridModalityJobsForFile = async (_input: {
  fileId: string;
  filetype: string;
}) => {
  // No-op until modality jobs land in Phase 1.
};
