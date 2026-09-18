/**
 * Dedicated render worker.
 *
 * Run it on a machine sized for video (CPU, RAM, a Chromium install) while the web app stays on
 * a normal Node host:
 *
 *   REDIS_URL=redis://... INLINE_RENDER=false pnpm --filter @nova/studio worker
 */
import { Worker } from 'bullmq';
import { getEnv } from '../lib/config/env';
import { RENDER_QUEUE_NAME, type RenderJobPayload } from '../lib/jobs/queue';
import { runRenderJob } from '../server/render-service';

const env = getEnv();

if (!env.REDIS_URL) {
  console.error('REDIS_URL is required to run the render worker.');
  process.exit(1);
}

const worker = new Worker<RenderJobPayload>(
  RENDER_QUEUE_NAME,
  async (job) => {
    console.warn(`[worker] rendering ${job.data.videoId} (job ${job.data.jobId})`);
    await runRenderJob(job.data.jobId);
  },
  {
    connection: { url: env.REDIS_URL },
    // Rendering is CPU-bound: one video at a time per worker, scale by adding workers.
    concurrency: 1,
    lockDuration: 10 * 60 * 1000,
  },
);

worker.on('completed', (job) => console.warn(`[worker] completed ${job.id}`));
worker.on('failed', (job, error) => console.error(`[worker] failed ${job?.id}:`, error.message));

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.warn(`[worker] listening on ${RENDER_QUEUE_NAME}`);
