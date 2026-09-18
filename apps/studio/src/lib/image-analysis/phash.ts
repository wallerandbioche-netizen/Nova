/**
 * Perceptual hashing (dHash, 64 bits).
 *
 * Two photos of the same room taken a second apart produce hashes a few bits apart; unrelated
 * photos land far away. That is what lets the selector drop "five nearly identical shots of the
 * sofa" without dropping "two genuinely different angles of the living room".
 */
export function computeDHash(grayscale: Uint8Array, width: number, height: number): string {
  if (width !== 9 || height !== 8) {
    throw new Error(`dHash expects a 9x8 grayscale buffer, received ${width}x${height}`);
  }
  let bits = '';
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = grayscale[y * 9 + x] ?? 0;
      const right = grayscale[y * 9 + x + 1] ?? 0;
      bits += left > right ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Number of differing bits between two hashes; 64 means "nothing in common". */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = parseInt(a[i] ?? '0', 16) ^ parseInt(b[i] ?? '0', 16);
    distance += POPCOUNT[diff] ?? 0;
  }
  return distance;
}

const POPCOUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Below this distance two photos are treated as the same shot. */
export const DUPLICATE_THRESHOLD = 6;
/** Below this they are different shots of the same subject: keep only the best one or two. */
export const SIMILARITY_THRESHOLD = 12;

export function areDuplicates(a: string, b: string): boolean {
  return hammingDistance(a, b) <= DUPLICATE_THRESHOLD;
}

export function areSimilar(a: string, b: string): boolean {
  return hammingDistance(a, b) <= SIMILARITY_THRESHOLD;
}
