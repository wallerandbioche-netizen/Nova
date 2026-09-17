import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { jpegFixture, pngFixture, webpFixture } from '@/features/analysis/testing/fakes';
import { buildStorageKey, sniffImageMimeType, validateUpload } from './upload';
import { formatBytes } from './upload-limits';

const OPTIONS = { userId: 'user_alice', maxBytes: 8 * 1024 * 1024 };

describe('sniffImageMimeType', () => {
  it('recognises the three supported formats by their header', () => {
    expect(sniffImageMimeType(pngFixture())).toBe('image/png');
    expect(sniffImageMimeType(jpegFixture())).toBe('image/jpeg');
    expect(sniffImageMimeType(webpFixture())).toBe('image/webp');
  });

  it('rejects anything else', () => {
    expect(sniffImageMimeType(Buffer.from('GIF89a and then some padding'))).toBeNull();
    expect(sniffImageMimeType(Buffer.from('%PDF-1.7 and then some padding'))).toBeNull();
    expect(sniffImageMimeType(Buffer.alloc(4))).toBeNull();
  });
});

describe('validateUpload', () => {
  it('accepts a real PNG', () => {
    const result = validateUpload(pngFixture(), {
      ...OPTIONS,
      filename: 'chart.png',
      declaredMimeType: 'image/png',
    });

    expect(result.mimeType).toBe('image/png');
    expect(result.bytes).toBe(2048);
    expect(result.key).toMatch(/^analyses\/user_alice\/[0-9a-f-]{36}\.png$/);
  });

  it('trusts the bytes over the declared type', () => {
    // A JPEG announced as a PNG: the extension check passes, the sniff decides.
    const result = validateUpload(jpegFixture(), {
      ...OPTIONS,
      filename: 'chart.png',
      declaredMimeType: 'image/png',
    });

    expect(result.mimeType).toBe('image/jpeg');
    expect(result.key.endsWith('.jpg')).toBe(true);
  });

  it('refuses a script renamed as an image', () => {
    const payload = Buffer.concat([
      Buffer.from('<?php system($_GET["c"]); ?>'),
      Buffer.alloc(2048, 0x20),
    ]);

    expect(() =>
      validateUpload(payload, { ...OPTIONS, filename: 'chart.png', declaredMimeType: 'image/png' }),
    ).toThrow(AppError);
  });

  it('refuses an unsupported extension before reading the bytes', () => {
    expect(() => validateUpload(pngFixture(), { ...OPTIONS, filename: 'chart.svg' })).toThrowError(
      /JPG, JPEG, PNG ou WEBP/,
    );
  });

  it('refuses an unsupported declared MIME type', () => {
    expect(() =>
      validateUpload(pngFixture(), {
        ...OPTIONS,
        filename: 'chart.png',
        declaredMimeType: 'image/svg+xml',
      }),
    ).toThrow(AppError);
  });

  it('refuses a file over the limit, and says by how much', () => {
    const tooBig = pngFixture(200);
    const error = (() => {
      try {
        validateUpload(pngFixture(5000), { userId: 'user_alice', maxBytes: 4096 });
      } catch (caught) {
        return caught as AppError;
      }
      return null;
    })();

    expect(error?.code).toBe('upload_too_large');
    expect(error?.message).toContain('4 Ko');
    expect(() => validateUpload(tooBig, OPTIONS)).toThrow(AppError);
  });

  it('refuses a file too small to hold a chart', () => {
    expect(() => validateUpload(pngFixture(64), OPTIONS)).toThrowError(/trop petit/);
  });

  it('never reuses the filename supplied by the client', () => {
    const result = validateUpload(pngFixture(), {
      ...OPTIONS,
      filename: '../../../etc/passwd.png',
      declaredMimeType: 'image/png',
    });

    expect(result.key).not.toContain('passwd');
    expect(result.key).not.toContain('..');
  });

  it('generates a different key every time', () => {
    const first = validateUpload(pngFixture(), OPTIONS);
    const second = validateUpload(pngFixture(), OPTIONS);

    expect(first.key).not.toBe(second.key);
  });
});

describe('buildStorageKey', () => {
  it('scopes the object under the owner id', () => {
    expect(buildStorageKey('user_alice', 'image/png')).toMatch(/^analyses\/user_alice\//);
  });

  it('strips anything that could escape the prefix', () => {
    const key = buildStorageKey('../../etc', 'image/png');

    // The traversal segments are stripped; what remains is an ordinary,
    // harmless path component under the analyses prefix.
    expect(key).not.toContain('..');
    expect(key.startsWith('analyses/etc/')).toBe(true);
  });

  it('refuses a user id that sanitises down to nothing', () => {
    expect(() => buildStorageKey('../..', 'image/png')).toThrow(AppError);
  });
});

describe('formatBytes', () => {
  it('reads naturally at every magnitude', () => {
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(4096)).toBe('4 Ko');
    expect(formatBytes(8 * 1024 * 1024)).toBe('8.0 Mo');
  });
});
