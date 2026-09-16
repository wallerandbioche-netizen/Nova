import type { Logger } from 'pino';
import type { Env } from '../../../config/env.js';
import { LocalStorageProvider } from './local-storage.provider.js';
import type { StorageProvider } from './storage-provider.js';

export * from './storage-provider.js';
export { LocalStorageProvider } from './local-storage.provider.js';

export function createStorageProvider(env: Env, logger: Logger): StorageProvider {
  if (env.STORAGE_PROVIDER === 's3') {
    // Kept explicit rather than silently degrading: an S3 deployment must add the adapter
    // documented in docs/08-providers.md before selecting this provider.
    logger.warn(
      'STORAGE_PROVIDER=s3 selected but no S3 adapter is bundled; falling back to local storage',
    );
  }
  return new LocalStorageProvider();
}
