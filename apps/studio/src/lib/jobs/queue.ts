import type { Queue } from 'bullmq';
import { getEnv } from '../config/env';

export interface RenderJobPayload {
  jobId: string;
  videoId: string;
}

/**
 * Job queue abstraction.
 *
 * Development runs the in-process queue: one command, no Redis, the whole product works.
 * Production sets REDIS_URL and INLINE_RENDER=false, and the same jobs are consumed by the
 * dedicated worker in src/workers/render-worker.ts. Nothing else in the code changes.
 */
export interface JobQueue {
  readonly name: string;
  enqueue(payload: RenderJobPayload): Promise<void>;
  close(): Promise<void>;
}

/** Runs the job in this process, right after the HTTP response is on its way. */
export class InProcessQueue implements JobQueue {
  readonly name = 'in-process';
  private running = 0;

  constructor(private readonly concurrency = 1) {}

  private readonly pending: RenderJobPayload[] = [];

  async enqueue(payload: RenderJobPayload): Promise<void> {
    this.pending.push(payload);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.running >= this.concurrency) return;
    const next = this.pending.shift();
    if (!next) return;

    this.running += 1;
    try {
      const { runRenderJob } = await import('../../server/render-service');
      await runRenderJob(next.jobId);
    } catch (error) {
      // runRenderJob already recorded the failure and refunded; nothing to do but log.
      console.error(`[render] job ${next.jobId} failed:`, error);
    } finally {
      this.running -= 1;
      void this.drain();
    }
  }

  async close(): Promise<void> {
    this.pending.length = 0;
  }
}

export const RENDER_QUEUE_NAME = 'nova-studio-render';

/** Redis-backed queue; the worker process consumes it. */
export class BullMqQueue implements JobQueue {
  readonly name = 'bullmq';
  private queue: Queue | null = null;

  constructor(private readonly redisUrl: string) {}

  private async getQueue(): Promise<Queue> {
    if (this.queue) return this.queue;
    const { Queue: BullQueue } = await import('bullmq');
    this.queue = new BullQueue(RENDER_QUEUE_NAME, {
      connection: { url: this.redisUrl },
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 86_400 },
      },
    });
    return this.queue;
  }

  async enqueue(payload: RenderJobPayload): Promise<void> {
    const queue = await this.getQueue();
    await queue.add('render', payload, { jobId: payload.jobId });
  }

  async close(): Promise<void> {
    await this.queue?.close();
    this.queue = null;
  }
}

let queue: JobQueue | null = null;

export function getQueue(): JobQueue {
  if (queue) return queue;
  const env = getEnv();
  queue = env.REDIS_URL && !env.INLINE_RENDER ? new BullMqQueue(env.REDIS_URL) : new InProcessQueue();
  return queue;
}

export function setQueue(next: JobQueue | null): void {
  queue = next;
}
