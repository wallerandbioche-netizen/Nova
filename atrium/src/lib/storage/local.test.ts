import { describe, expect, it } from 'vitest';
import { safeKey } from './local';

describe('safeKey', () => {
  it('normalise les clés valides', () => {
    expect(safeKey('src/photo_01.jpg')).toBe('src/photo_01.jpg');
    expect(safeKey('./video/final.mp4')).toBe('video/final.mp4');
  });

  it('refuse les traversées de répertoire', () => {
    expect(() => safeKey('../../etc/passwd')).toThrow();
    expect(() => safeKey('/etc/passwd')).toThrow();
    expect(() => safeKey('')).toThrow();
  });

  it('neutralise une traversée imbriquée', () => {
    expect(safeKey('src/../video/final.mp4')).toBe('video/final.mp4');
  });
});
