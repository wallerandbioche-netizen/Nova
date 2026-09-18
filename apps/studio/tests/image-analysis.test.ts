import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { HeuristicImageAnalyzer, qualityScore, focalPoint, gradientEnergy } from '@/lib/image-analysis/heuristic';
import { detectRoomFromHint } from '@/lib/image-analysis/rooms';
import { parseClassification } from '@/lib/image-analysis/vision';
import { hammingDistance } from '@/lib/image-analysis/phash';

async function photo(svg: string, width = 1200, height = 800): Promise<Buffer> {
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${svg}</svg>`))
    .jpeg()
    .toBuffer();
}

const analyzer = new HeuristicImageAnalyzer();

describe('HeuristicImageAnalyzer', () => {
  it('reads the real dimensions and format', async () => {
    const analysis = await analyzer.analyze({ buffer: await photo('<rect width="100%" height="100%" fill="#888"/>', 1600, 900) });
    expect(analysis.width).toBe(1600);
    expect(analysis.height).toBe(900);
    expect(analysis.format).toBe('jpeg');
  });

  it('scores a detailed photo as sharper than a flat one', async () => {
    const flat = await analyzer.analyze({ buffer: await photo('<rect width="100%" height="100%" fill="#7a7a7a"/>') });
    const detailed = await analyzer.analyze({
      buffer: await photo(
        Array.from({ length: 40 }, (_, i) => `<rect x="${i * 30}" width="15" height="800" fill="${i % 2 ? '#111' : '#eee'}"/>`).join(''),
      ),
    });
    expect(detailed.sharpness).toBeGreaterThan(flat.sharpness);
    expect(detailed.quality).toBeGreaterThan(flat.quality);
  });

  it('measures exposure', async () => {
    const dark = await analyzer.analyze({ buffer: await photo('<rect width="100%" height="100%" fill="#0a0a0a"/>') });
    const bright = await analyzer.analyze({ buffer: await photo('<rect width="100%" height="100%" fill="#f6f6f6"/>') });
    expect(dark.brightness).toBeLessThan(0.15);
    expect(bright.brightness).toBeGreaterThan(0.9);
  });

  it('gives the same photo the same hash and a different photo a different one', async () => {
    const buffer = await photo('<rect width="60%" height="100%" fill="#222"/>');
    const [a, b] = await Promise.all([
      analyzer.analyze({ buffer }),
      analyzer.analyze({ buffer }),
    ]);
    const other = await analyzer.analyze({ buffer: await photo('<circle cx="200" cy="200" r="150" fill="#eee"/>') });

    expect(a.phash).toBe(b.phash);
    expect(hammingDistance(a.phash, other.phash)).toBeGreaterThan(6);
  });

  it('puts the focal point where the detail is', async () => {
    const analysis = await analyzer.analyze({
      buffer: await photo(
        '<rect width="100%" height="100%" fill="#dddddd"/>' +
          Array.from({ length: 12 }, (_, i) => `<rect x="${900 + (i % 4) * 20}" y="${100 + Math.floor(i / 4) * 30}" width="12" height="18" fill="#101010"/>`).join(''),
      ),
    });
    // Detail sits on the right-hand side, so the focal point leans that way.
    expect(analysis.focalX).toBeGreaterThan(0.5);
  });

  it('never returns a focal point outside the safe area', async () => {
    const analysis = await analyzer.analyze({ buffer: await photo('<rect x="0" y="0" width="30" height="30" fill="#000"/>') });
    expect(analysis.focalX).toBeGreaterThanOrEqual(0.15);
    expect(analysis.focalX).toBeLessThanOrEqual(0.85);
    expect(analysis.focalY).toBeGreaterThanOrEqual(0.15);
    expect(analysis.focalY).toBeLessThanOrEqual(0.85);
  });

  it('leaves the room unknown when the listing gives no caption', async () => {
    const analysis = await analyzer.analyze({ buffer: await photo('<rect width="100%" height="100%" fill="#999"/>') });
    expect(analysis.room).toBe('OTHER');
    expect(analysis.roomConfidence).toBe(0);
  });

  it('uses the caption when there is one', async () => {
    const analysis = await analyzer.analyze({
      buffer: await photo('<rect width="100%" height="100%" fill="#999"/>'),
      hint: 'Belle cuisine équipée',
    });
    expect(analysis.room).toBe('KITCHEN');
  });
});

describe('room detection', () => {
  it.each([
    ['Salon lumineux', 'LIVING_ROOM'],
    ['Cuisine ouverte', 'KITCHEN'],
    ['Chambre principale avec lit king size', 'BEDROOM'],
    ['Salle de bain avec douche', 'BATHROOM'],
    ['Terrasse ombragée', 'TERRACE'],
    ['Piscine chauffée', 'POOL'],
    ['Vue sur la mer', 'VIEW'],
    ['Jardin arboré', 'GARDEN'],
    ['Living room with sofa', 'LIVING_ROOM'],
    ['Master bedroom', 'BEDROOM'],
  ])('reads %j as %s', (hint, expected) => {
    expect(detectRoomFromHint(hint).room).toBe(expected);
  });

  it('does not guess', () => {
    expect(detectRoomFromHint('IMG_4821').room).toBe('OTHER');
    expect(detectRoomFromHint(undefined).room).toBe('OTHER');
    expect(detectRoomFromHint('').confidence).toBe(0);
  });
});

describe('quality score', () => {
  it('prefers big, sharp, well-exposed photos', () => {
    const good = qualityScore({ width: 3000, height: 2000, sharpness: 0.8, brightness: 0.5 });
    const smallish = qualityScore({ width: 700, height: 500, sharpness: 0.8, brightness: 0.5 });
    const blurry = qualityScore({ width: 3000, height: 2000, sharpness: 0.1, brightness: 0.5 });
    const dark = qualityScore({ width: 3000, height: 2000, sharpness: 0.8, brightness: 0.05 });

    expect(good).toBeGreaterThan(smallish);
    expect(good).toBeGreaterThan(blurry);
    expect(good).toBeGreaterThan(dark);
    expect(good).toBeLessThanOrEqual(1);
    expect(blurry).toBeGreaterThanOrEqual(0);
  });

  it('penalises extreme panoramas that crop badly', () => {
    const panorama = qualityScore({ width: 6000, height: 1200, sharpness: 0.8, brightness: 0.5 });
    const normal = qualityScore({ width: 3000, height: 2000, sharpness: 0.8, brightness: 0.5 });
    expect(panorama).toBeLessThan(normal);
  });
});

describe('focal point maths', () => {
  it('falls back to the centre when there is no detail at all', () => {
    expect(focalPoint(new Float32Array(64 * 64), 64, 64)).toEqual({ x: 0.5, y: 0.5 });
  });

  it('measures gradient energy', () => {
    const flat = new Uint8Array(16 * 16).fill(120);
    const edges = new Uint8Array(16 * 16);
    for (let i = 0; i < edges.length; i += 1) edges[i] = i % 2 === 0 ? 0 : 255;
    expect(gradientEnergy(edges, 16, 16).mean).toBeGreaterThan(gradientEnergy(flat, 16, 16).mean);
  });
});

describe('vision response parsing', () => {
  it('reads a well-formed answer', () => {
    expect(parseClassification('{"room":"KITCHEN","confidence":0.9,"focalX":0.4,"focalY":0.6}')).toEqual({
      room: 'KITCHEN',
      confidence: 0.9,
      focalX: 0.4,
      focalY: 0.6,
    });
  });

  it('finds JSON wrapped in prose', () => {
    expect(parseClassification('Voici : {"room":"POOL","confidence":0.7} — voilà.')?.room).toBe('POOL');
  });

  it('refuses an unknown room rather than inventing one', () => {
    expect(parseClassification('{"room":"DUNGEON","confidence":1}')).toBeNull();
    expect(parseClassification('pas de json ici')).toBeNull();
    expect(parseClassification('{"room":"POOL","focalX":5}')?.focalX).toBeUndefined();
  });
});
