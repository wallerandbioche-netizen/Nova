export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  /** Objects are private by default; nothing becomes public without asking for it. */
  cacheControl?: string;
}

export interface StoredObject {
  key: string;
  bytes: number;
  contentType: string;
}

/**
 * Storage is behind this interface so the product can move between local disk (dev),
 * S3, R2 or Supabase Storage without touching a single call site.
 */
export interface StorageProvider {
  readonly name: string;
  put(input: PutObjectInput): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Temporary, signed URL for a private object. */
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
