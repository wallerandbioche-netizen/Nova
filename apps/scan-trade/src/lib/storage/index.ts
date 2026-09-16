import { getStorageConfig } from '@/lib/env';
import { LocalStorageDriver } from './local';
import { S3StorageDriver } from './s3';
import type { StorageDriver } from './types';

export { StorageError } from './types';
export type { StorageDriver, StoredObject } from './types';

let cached: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (cached) return cached;
  const config = getStorageConfig();
  cached = config.driver === 'local' ? new LocalStorageDriver(config.directory) : new S3StorageDriver(config);
  return cached;
}

/** Test helper. */
export function setStorageDriver(driver: StorageDriver | null): void {
  cached = driver;
}
