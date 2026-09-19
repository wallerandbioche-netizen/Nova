'use client';

import type { ApiErrorResponse, CreateProjectResponse, UploadResponse } from '@/types/api';

export const GENERIC_ERROR = 'Une erreur est survenue. Veuillez réessayer.';

/** Récupère le message déjà rédigé par l'API, sans jamais exposer de trace. */
export async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ApiErrorResponse | null;
  return body?.error?.message ?? GENERIC_ERROR;
}

/** Dépose un travail de génération et renvoie l'identifiant du projet. */
export async function startProject(body: Record<string, unknown>): Promise<string> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readApiError(response));
  const { id } = (await response.json()) as CreateProjectResponse;
  return id;
}

/** Envoie les fichiers choisis puis lance la génération sur ces photos. */
export async function startFromFiles(files: File[]): Promise<string> {
  const form = new FormData();
  for (const file of files) form.append('photos', file);

  const response = await fetch('/api/uploads', { method: 'POST', body: form });
  if (!response.ok) throw new Error(await readApiError(response));

  const { uploadId } = (await response.json()) as UploadResponse;
  return startProject({ uploadId });
}
