import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageError, type StorageDriver, type StoredObject } from './types';

export interface S3DriverOptions {
  bucket: string;
  region: string;
  endpoint: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  signedUrlTtlSeconds: number;
}

/**
 * S3-compatible driver (AWS S3, Cloudflare R2, Supabase Storage's S3 endpoint,
 * MinIO). Objects are written private; browser reads go through a presigned URL
 * that expires within minutes (§42).
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3';
  private readonly client: S3Client;
  private readonly options: S3DriverOptions;

  constructor(options: S3DriverOptions) {
    this.options = options;
    this.client = new S3Client({
      region: options.region,
      ...(options.endpoint ? { endpoint: options.endpoint } : {}),
      forcePathStyle: options.forcePathStyle,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async put(key: string, data: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.options.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          // Defence in depth: even a misconfigured bucket policy keeps this private.
          ACL: 'private',
          CacheControl: 'private, no-store',
        }),
      );
    } catch (cause) {
      throw new StorageError("L'image n'a pas pu être enregistrée.", { cause });
    }
  }

  async getObject(key: string): Promise<StoredObject> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      );
      const body = result.Body;
      if (!body) throw new StorageError('Objet vide.');
      const bytes = await body.transformToByteArray();
      return { data: Buffer.from(bytes), contentType: result.ContentType ?? 'application/octet-stream' };
    } catch (cause) {
      if (cause instanceof StorageError) throw cause;
      throw new StorageError("L'image n'a pas pu être récupérée.", { cause });
    }
  }

  async createViewUrl(key: string): Promise<string | null> {
    try {
      return await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.options.bucket, Key: key }), {
        expiresIn: this.options.signedUrlTtlSeconds,
      });
    } catch (cause) {
      throw new StorageError("L'image n'a pas pu être récupérée.", { cause });
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
    } catch (cause) {
      throw new StorageError("L'image n'a pas pu être supprimée.", { cause });
    }
  }
}
