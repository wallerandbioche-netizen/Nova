import sharp from 'sharp';

/**
 * dHash 64 bits : on compare chaque pixel à son voisin de droite sur une
 * miniature 9×8 en niveaux de gris. Robuste au recadrage léger, à la
 * compression et aux variations d'exposition — exactement ce qu'il faut pour
 * repérer deux photos prises du même angle.
 */
export async function perceptualHash(filePath: string): Promise<string> {
  const raw = await sharp(filePath)
    .removeAlpha()
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  let bits = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = raw[y * 9 + x] ?? 0;
      const right = raw[y * 9 + x + 1] ?? 0;
      bits = (bits << 1n) | (left > right ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

/** Nombre de bits différents entre deux empreintes (0 = identiques). */
export function hammingDistance(a: string, b: string): number {
  let diff = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}
