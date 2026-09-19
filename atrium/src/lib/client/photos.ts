'use client';

/**
 * Préparation des photos avant envoi, dans le navigateur.
 *
 * Un lot de photos de téléphone pèse facilement cent mégaoctets, alors que le
 * serveur les ramène de toute façon à 2800 pixels. Les réduire ici rend
 * l'envoi presque instantané sans rien coûter à la qualité finale : le rendu
 * travaille sur une définition largement supérieure à celle de la sortie.
 */

/** Définition de travail : trois fois la largeur d'une sortie verticale. */
const MAX_EDGE = 2800;
const JPEG_QUALITY = 0.92;
const MAX_INPUT_BYTES = 60 * 1024 * 1024;

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const MIN_PHOTOS = 3;
export const RECOMMENDED_PHOTOS = 6;
export const MAX_PHOTOS = 40;

export interface PreparedPhoto {
  /** Fichier réduit, prêt à être envoyé. */
  blob: Blob;
  name: string;
  /** URL locale d'aperçu — à libérer avec `releasePreview`. */
  preview: string;
  width: number;
  height: number;
}

export function isAcceptedPhoto(file: File): boolean {
  return (
    (ACCEPTED_TYPES as readonly string[]).includes(file.type) &&
    file.size > 0 &&
    file.size <= MAX_INPUT_BYTES
  );
}

/**
 * Réduit une photo et en fait un aperçu.
 *
 * `imageOrientation: 'from-image'` applique l'orientation EXIF aux pixels :
 * sans cela, une photo prise à la verticale arriverait couchée une fois les
 * métadonnées perdues au réencodage.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Fichier illisible ou corrompu : on l'écarte sans faire échouer le lot.
    return null;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return null;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) return null;

  return {
    blob,
    name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
    preview: URL.createObjectURL(blob),
    width,
    height,
  };
}

export function releasePreview(photo: PreparedPhoto): void {
  URL.revokeObjectURL(photo.preview);
}
