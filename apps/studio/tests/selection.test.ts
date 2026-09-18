import { describe, expect, it } from 'vitest';
import type { RoomType } from '@prisma/client';
import { selectImages, orderForNarrative, type SelectableImage } from '@/lib/selection';
import { hammingDistance, areDuplicates } from '@/lib/image-analysis/phash';

let counter = 0;
function image(overrides: Partial<SelectableImage> = {}): SelectableImage {
  counter += 1;
  return {
    id: `img-${counter}`,
    width: 1920,
    height: 1280,
    quality: 0.7,
    sharpness: 0.6,
    phash: counter.toString(16).padStart(16, '0'),
    room: 'OTHER' as RoomType,
    sortOrder: counter,
    ...overrides,
  };
}

describe('selectImages', () => {
  it('drops photos that are too small for video', () => {
    const small = image({ width: 320, height: 240 });
    const result = selectImages([small, image(), image(), image()]);
    expect(result.selected.map((i) => i.id)).not.toContain(small.id);
    expect(result.rejected).toContainEqual({ image: small, reason: 'TOO_SMALL' });
  });

  it('keeps one photo out of a set of duplicates', () => {
    const hash = 'ffffffffffffffff';
    const best = image({ phash: hash, quality: 0.9 });
    const copy = image({ phash: hash, quality: 0.5 });
    const result = selectImages([best, copy, image(), image()]);

    expect(result.selected.map((i) => i.id)).toContain(best.id);
    expect(result.selected.map((i) => i.id)).not.toContain(copy.id);
    expect(result.rejected.find((r) => r.image.id === copy.id)?.reason).toBe('DUPLICATE');
  });

  it('caps how many photos of the same room make the cut', () => {
    // Visually distinct shots of the same room: far apart as hashes, same room type.
    const distinctHashes = [
      '0f0f0f0f0f0f0f0f',
      'f0f0f0f0f0f0f0f0',
      '00ff00ff00ff00ff',
      'ff00ff00ff00ff00',
      '3333cccc3333cccc',
      'cccc33333cccc333',
    ];
    const sofas = distinctHashes.map((phash, index) =>
      image({ room: 'LIVING_ROOM', phash, quality: 0.8 - index * 0.01 }),
    );
    const result = selectImages([...sofas, image({ room: 'KITCHEN' }), image({ room: 'POOL' })]);
    const livingRooms = result.selected.filter((i) => i.room === 'LIVING_ROOM');
    expect(livingRooms.length).toBeLessThanOrEqual(3);
    expect(result.rejected.some((r) => r.reason === 'ROOM_QUOTA' || r.reason === 'TOO_SIMILAR')).toBe(true);
  });

  it('never returns more than the configured maximum', () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      image({ phash: index.toString(16).padStart(16, '0'), room: 'OTHER' }),
    );
    expect(selectImages(many, { maxImages: 12 }).selected.length).toBeLessThanOrEqual(12);
  });

  it('accepts weaker photos rather than returning too few', () => {
    const blurry = image({ quality: 0.05 });
    const result = selectImages([image({ quality: 0.9 }), image({ quality: 0.8 }), blurry], {
      minImages: 3,
    });
    expect(result.selected).toHaveLength(3);
  });

  it('is deterministic', () => {
    const input = [image(), image(), image(), image(), image()];
    const first = selectImages(input).selected.map((i) => i.id);
    const second = selectImages(input).selected.map((i) => i.id);
    expect(first).toEqual(second);
  });
});

describe('orderForNarrative', () => {
  it('opens outside, walks through the rooms, ends on the view', () => {
    const ordered = orderForNarrative([
      image({ room: 'BATHROOM', quality: 0.6 }),
      image({ room: 'VIEW', quality: 0.9 }),
      image({ room: 'EXTERIOR', quality: 0.85 }),
      image({ room: 'KITCHEN', quality: 0.7 }),
      image({ room: 'LIVING_ROOM', quality: 0.75 }),
    ]);
    const rooms = ordered.map((i) => i.room);

    expect(rooms[0]).toBe('EXTERIOR');
    expect(rooms[rooms.length - 1]).toBe('VIEW');
    expect(rooms.indexOf('LIVING_ROOM')).toBeLessThan(rooms.indexOf('BATHROOM'));
  });

  it('never invents a room that is not in the set', () => {
    const input = [image({ room: 'BEDROOM' }), image({ room: 'BEDROOM' }), image({ room: 'KITCHEN' })];
    const rooms = new Set(orderForNarrative(input).map((i) => i.room));
    expect([...rooms].sort()).toEqual(['BEDROOM', 'KITCHEN']);
  });

  it('keeps every photo it was given', () => {
    const input = [image(), image(), image(), image()];
    expect(orderForNarrative(input)).toHaveLength(input.length);
  });
});

describe('perceptual hashing', () => {
  it('measures distance between hashes', () => {
    expect(hammingDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(hammingDistance('0000000000000000', '0000000000000001')).toBe(1);
    expect(hammingDistance('ffffffffffffffff', '0000000000000000')).toBe(64);
  });

  it('treats near-identical hashes as duplicates', () => {
    expect(areDuplicates('abcdef0123456789', 'abcdef0123456789')).toBe(true);
    expect(areDuplicates('abcdef0123456789', '0123456789abcdef')).toBe(false);
  });
});
