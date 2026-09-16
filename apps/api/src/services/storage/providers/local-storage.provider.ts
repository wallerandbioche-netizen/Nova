import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import type { StorageProvider, StoredObject } from './storage-provider.js';

/**
 * Local filesystem storage, used in development and for short-lived exports.
 *
 * Keys are constrained to the storage root: a key containing `..` cannot escape it.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';
  private readonly root: string;

  constructor(root = join(process.cwd(), '.storage')) {
    this.root = resolve(root);
  }

  private pathFor(key: string): string {
    const target = resolve(join(this.root, normalize(key)));
    if (!target.startsWith(this.root)) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  async put(key: string, content: Buffer | string, _contentType: string): Promise<StoredObject> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
    await writeFile(path, buffer);
    return { key, url: null, size: buffer.byteLength, expiresAt: null };
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathFor(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
