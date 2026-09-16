export interface StoredObject {
  data: Buffer;
  contentType: string;
}

/**
 * Object storage seam. Chart screenshots are private user data (§44): a driver
 * must never expose an object through a durable public URL.
 */
export interface StorageDriver {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  /** Reads the bytes back — used by the scan pipeline to feed the vision model. */
  getObject(key: string): Promise<StoredObject>;
  /**
   * A short-lived URL the browser may follow, or null when the driver has no
   * signing capability and the bytes must be proxied by the app instead.
   */
  createViewUrl(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}
