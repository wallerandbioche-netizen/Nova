import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../errors';
import type { PutObjectInput, StorageProvider, StoredObject } from './types';

/**
 * Development storage: files live under a directory that is never served statically.
 * Downloads go through /api/files/[...key] with an HMAC-signed, expiring URL, so the
 * privacy model is the same one production gets from S3 presigned URLs.
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  constructor(
    private readonly rootDir: string,
    private readonly secret: string,
  ) {}

  private resolve(key: string): string {
    const normalised = path.posix.normalize(key).replace(/^\/+/, '');
    if (normalised.startsWith('..') || path.isAbsolute(normalised)) {
      throw new AppError('VALIDATION_FAILED', 'Clé de stockage invalide.');
    }
    return path.join(this.rootDir, normalised);
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    const target = this.resolve(input.key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, input.body);
    return { key: input.key, bytes: input.body.byteLength, contentType: input.contentType };
  }

  async get(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolve(key));
    } catch (cause) {
      throw new AppError('NOT_FOUND', 'Fichier introuvable.', { cause });
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    await rm(this.resolve(prefix), { force: true, recursive: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = signKey(this.secret, key, expires);
    return `/api/files/${key.split('/').map(encodeURIComponent).join('/')}?expires=${expires}&signature=${signature}`;
  }
}

export function signKey(secret: string, key: string, expires: number): string {
  return createHmac('sha256', secret).update(`${key}:${expires}`).digest('hex');
}

export function verifyKeySignature(
  secret: string,
  key: string,
  expires: number,
  signature: string,
): boolean {
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
  const expected = signKey(secret, key, expires);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
