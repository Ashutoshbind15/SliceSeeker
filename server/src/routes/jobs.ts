import { Queue } from "bullmq";
import type { Request, Response } from "express";
import { z } from "zod";
import { getValkeyConnectionOptions, JOB_QUEUE_NAME } from "../lib/queue.js";

const enqueueJobSchema = z.object({
  message: z.string().optional(),
});

const jobQueue = new Queue(JOB_QUEUE_NAME, {
  connection: getValkeyConnectionOptions(),
});

export const enqueueJobHandler = async (req: Request, res: Response) => {
  const parsed = enqueueJobSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid job request" });
    return;
  }

  const job = await jobQueue.add("test-job", parsed.data);

  res.status(202).json({ jobId: job.id });
};
