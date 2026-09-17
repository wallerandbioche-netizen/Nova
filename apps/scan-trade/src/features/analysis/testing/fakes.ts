import type { StorageDriver, StoredObject } from '@/lib/storage';
import { StorageError } from '@/lib/storage';
import type { UsageRecorder } from '../service';

/** Storage driver backed by a Map. Records deletions so tests can assert cleanup. */
export class MemoryStorageDriver implements StorageDriver {
  readonly name = 'memory';
  readonly objects = new Map<string, StoredObject>();
  readonly removed: string[] = [];
  /** Set to make the next `put` throw, to exercise the failure path. */
  failNextPut = false;

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new StorageError('put a échoué (test)');
    }
    this.objects.set(key, { data, contentType });
  }

  async getObject(key: string): Promise<StoredObject> {
    const object = this.objects.get(key);
    if (!object) throw new StorageError('objet absent (test)');
    return object;
  }

  async createViewUrl(): Promise<string | null> {
    return null;
  }

  async remove(key: string): Promise<void> {
    this.removed.push(key);
    this.objects.delete(key);
  }
}

export class MemoryUsageRecorder implements UsageRecorder {
  readonly events: Array<{ userId: string; kind: string }> = [];

  async record(userId: string, kind: 'ANALYSIS_SCAN' | 'ANALYSIS_UPLOAD'): Promise<void> {
    this.events.push({ userId, kind });
  }
}

/** A minimal PNG that passes the magic-byte check. */
export function pngFixture(sizeBytes = 2048): Buffer {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([header, Buffer.alloc(Math.max(0, sizeBytes - header.length), 0x42)]);
}

export function jpegFixture(sizeBytes = 2048): Buffer {
  const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  return Buffer.concat([header, Buffer.alloc(Math.max(0, sizeBytes - header.length), 0x42)]);
}

export function webpFixture(sizeBytes = 2048): Buffer {
  const buffer = Buffer.alloc(Math.max(12, sizeBytes), 0x42);
  buffer.write('RIFF', 0, 'ascii');
  buffer.write('WEBP', 8, 'ascii');
  return buffer;
}
