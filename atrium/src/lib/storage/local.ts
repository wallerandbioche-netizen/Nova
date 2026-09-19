import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '@/lib/env';
import type { StorageDriver } from './types';

/** Refuse toute clé qui tenterait de sortir du répertoire du projet. */
export function safeKey(key: string): string {
  const normalized = path.posix.normalize(key.split(path.sep).join('/'));
  if (
    normalized === '' ||
    normalized === '.' ||
    normalized.startsWith('..') ||
    normalized.startsWith('/')
  ) {
    throw new Error(`Clé de stockage refusée : ${key}`);
  }
  return normalized;
}

export class LocalDiskStorage implements StorageDriver {
  constructor(private readonly root: string = env.storageDir) {}

  private dirOf(projectId: string): string {
    return path.join(this.root, 'projects', safeKey(projectId));
  }

  async projectDir(projectId: string): Promise<string> {
    const dir = this.dirOf(projectId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  resolve(projectId: string, key: string): string {
    return path.join(this.dirOf(projectId), safeKey(key));
  }

  async write(projectId: string, key: string, data: Buffer): Promise<string> {
    const target = this.resolve(projectId, key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    return target;
  }

  publicUrl(projectId: string, key: string): string {
    return `/api/media/${encodeURIComponent(projectId)}/${safeKey(key)
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  }

  async size(projectId: string, key: string): Promise<number> {
    const stat = await fs.stat(this.resolve(projectId, key));
    return stat.size;
  }

  async remove(projectId: string): Promise<void> {
    await fs.rm(this.dirOf(projectId), { recursive: true, force: true });
  }
}

let singleton: StorageDriver | null = null;

export function storage(): StorageDriver {
  singleton ??= new LocalDiskStorage();
  return singleton;
}
