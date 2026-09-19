'use client';

import type { PreparedPhoto } from './photos';

/**
 * Envoi des photos avec avancement réel.
 *
 * `fetch` ne rend pas compte de la progression d'un envoi ; pour un lot de
 * photos, une barre qui n'avance pas donne l'impression que rien ne se passe.
 * XMLHttpRequest reste le seul moyen d'obtenir cet événement.
 */
export function uploadPhotos(
  photos: PreparedPhoto[],
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const photo of photos) form.append('photos', photo.blob, photo.name);

    const request = new XMLHttpRequest();
    request.open('POST', '/api/uploads');
    request.responseType = 'json';

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });

    request.addEventListener('load', () => {
      const body = request.response as { uploadId?: string; error?: { message?: string } } | null;
      if (request.status >= 200 && request.status < 300 && body?.uploadId) {
        onProgress(1);
        resolve(body.uploadId);
      } else {
        reject(new Error(body?.error?.message ?? 'Une erreur est survenue. Veuillez réessayer.'));
      }
    });

    request.addEventListener('error', () =>
      reject(new Error('L’envoi des photos a échoué. Vérifiez votre connexion.')),
    );
    request.addEventListener('abort', () => reject(new DOMException('Annulé', 'AbortError')));

    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(form);
  });
}
