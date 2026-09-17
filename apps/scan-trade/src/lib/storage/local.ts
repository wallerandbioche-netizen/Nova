import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { StorageError, type StorageDriver, type StoredObject } from './types';

/**
 * Filesystem driver for local development.
 *
 * It is a real driver, not a stub: bytes are written and read back. What it is
 * not is a production store — files live outside `public/`, are never served
 * statically, and every read still goes through the ownership check in the
 * route handler.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local';
  private readonly root: string;

  constructor(directory: string) {
    this.root = path.resolve(process.cwd(), directory);
  }

  /** Resolves a key inside the storage root, refusing anything that escapes it. */
  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    const withSeparator = this.root.endsWith(path.sep) ? this.root : `${this.root}${path.sep}`;
    if (!target.startsWith(withSeparator)) {
      throw new StorageError('Clé de stockage invalide.');
    }
    return target;
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    await writeFile(`${target}.meta`, JSON.stringify({ contentType }), 'utf8');
  }

  async getObject(key: string): Promise<StoredObject> {
    const target = this.resolve(key);
    try {
      const data = await readFile(target);
      let contentType = 'application/octet-stream';
      try {
        const meta = JSON.parse(await readFile(`${target}.meta`, 'utf8')) as {
          contentType?: string;
        };
        if (meta.contentType) contentType = meta.contentType;
      } catch {
        // Metadata is a convenience; the caller falls back to the stored MIME type.
      }
      return { data, contentType };
    } catch (cause) {
      if (cause instanceof StorageError) throw cause;
      throw new StorageError("L'image demandée est introuvable dans le stockage local.", { cause });
    }
  }

  /** The local driver cannot sign anything: the app proxies the bytes instead. */
  async createViewUrl(): Promise<string | null> {
    return null;
  }

  async remove(key: string): Promise<void> {
    const target = this.resolve(key);
    await rm(target, { force: true });
    await rm(`${target}.meta`, { force: true });
  }
}
