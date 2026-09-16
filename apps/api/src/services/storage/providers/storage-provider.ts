/**
 * Storage abstraction, used today for RGPD data exports and ready for S3-compatible storage
 * (rule: "Prévoir un service StorageProvider").
 */
export interface StoredObject {
  key: string;
  /** Direct URL when the backend can expose one, otherwise null and the API streams the file. */
  url: string | null;
  size: number;
  expiresAt: Date | null;
}

export interface StorageProvider {
  readonly name: string;
  put(key: string, content: Buffer | string, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}
