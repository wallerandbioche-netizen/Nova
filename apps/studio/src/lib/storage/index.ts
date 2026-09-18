import path from 'node:path';
import { getEnv } from '../config/env';
import { AppError } from '../errors';
import { LocalStorageProvider } from './local';
import { S3StorageProvider } from './s3';
import type { StorageProvider } from './types';

export type { StorageProvider, StoredObject, PutObjectInput } from './types';
export { LocalStorageProvider, signKey, verifyKeySignature } from './local';
export { S3StorageProvider } from './s3';

let provider: StorageProvider | null = null;

export function getStorage(): StorageProvider {
  if (provider) return provider;
  const env = getEnv();

  if (env.STORAGE_DRIVER === 's3') {
    if (!env.STORAGE_BUCKET || !env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY) {
      throw new AppError('STORAGE_UNAVAILABLE', 'La configuration du stockage S3 est incomplète.');
    }
    provider = new S3StorageProvider({
      bucket: env.STORAGE_BUCKET,
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      accessKeyId: env.STORAGE_ACCESS_KEY,
      secretAccessKey: env.STORAGE_SECRET_KEY,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    });
  } else {
    provider = new LocalStorageProvider(
      path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR),
      env.AUTH_SECRET,
    );
  }
  return provider;
}

export function setStorage(next: StorageProvider | null): void {
  provider = next;
}

export const storageKeys = {
  listingImage: (userId: string, listingId: string, imageId: string, ext: string) =>
    `users/${userId}/listings/${listingId}/images/${imageId}.${ext}`,
  listingThumbnail: (userId: string, listingId: string, imageId: string) =>
    `users/${userId}/listings/${listingId}/thumbs/${imageId}.webp`,
  listingPrefix: (userId: string, listingId: string) => `users/${userId}/listings/${listingId}`,
  video: (userId: string, videoId: string) => `users/${userId}/videos/${videoId}/video.mp4`,
  videoPoster: (userId: string, videoId: string) => `users/${userId}/videos/${videoId}/poster.jpg`,
  videoPrefix: (userId: string, videoId: string) => `users/${userId}/videos/${videoId}`,
};
