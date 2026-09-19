import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const log = logger('jobs');

export type JobTask = (signal: AbortSignal) => Promise<void>;

/**
 * File de travaux. Une génération vidéo dure des dizaines de secondes : elle
 * ne peut pas tenir dans le temps d'une requête HTTP. L'API dépose un travail
 * et rend la main ; l'interface suit l'avancement par interrogation.
 */
export interface JobQueue {
  enqueue(id: string, task: JobTask): void;
  cancel(id: string): void;
  /** Travaux en attente ou en cours. */
  size(): number;
}

interface Entry {
  id: string;
  task: JobTask;
}

export class InMemoryJobQueue implements JobQueue {
  private readonly pending: Entry[] = [];
  private readonly running = new Map<string, AbortController>();

  constructor(private readonly concurrency: number = env.jobConcurrency) {}

  enqueue(id: string, task: JobTask): void {
    this.pending.push({ id, task });
    queueMicrotask(() => this.drain());
  }

  cancel(id: string): void {
    const index = this.pending.findIndex((entry) => entry.id === id);
    if (index !== -1) this.pending.splice(index, 1);
    this.running.get(id)?.abort();
  }

  size(): number {
    return this.pending.length + this.running.size;
  }

  private drain(): void {
    while (this.running.size < this.concurrency) {
      const entry = this.pending.shift();
      if (!entry) return;

      const controller = new AbortController();
      this.running.set(entry.id, controller);

      void entry
        .task(controller.signal)
        .catch((error: unknown) => {
          // Les erreurs métier sont déjà consignées dans le projet ; ici on ne
          // journalise que ce qui aurait échappé au pipeline.
          log.error(`travail ${entry.id} interrompu`, String(error));
        })
        .finally(() => {
          this.running.delete(entry.id);
          this.drain();
        });
    }
  }
}

const GLOBAL_KEY = Symbol.for('atrium.jobQueue');
type GlobalScope = typeof globalThis & { [GLOBAL_KEY]?: JobQueue };

export function jobQueue(): JobQueue {
  const scope = globalThis as GlobalScope;
  scope[GLOBAL_KEY] ??= new InMemoryJobQueue();
  return scope[GLOBAL_KEY];
}
