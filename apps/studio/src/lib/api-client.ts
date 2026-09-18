'use client';

import type { AppErrorCode } from './errors';

export interface ApiError {
  code: AppErrorCode;
  message: string;
  recovery?: 'MANUAL_UPLOAD' | 'BUY_CREDITS' | 'RETRY' | null;
}

export class ApiRequestError extends Error {
  constructor(readonly error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
  }
}

/** Every client call goes through here, so an API error always arrives as a typed object. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }),
      ...init?.headers,
    },
  });

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: ApiError })
    | null;

  if (!response.ok) {
    throw new ApiRequestError(
      payload?.error ?? { code: 'INTERNAL', message: 'Une erreur inattendue est survenue.' },
    );
  }
  return payload as T;
}

export interface SerialisedImage {
  id: string;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape' | 'square';
  quality: number;
  room: string;
  roomLabel: string;
  isDuplicate: boolean;
  sortOrder: number;
  thumbnailUrl: string;
}

export interface SerialisedListing {
  id: string;
  title: string | null;
  location: string | null;
  sourceUrl: string | null;
  platform: string;
  status: string;
  notice: string | null;
  images: SerialisedImage[];
}

export interface SerialisedJob {
  id: string;
  status: string;
  stage: string;
  stageLabel: string;
  progress: number;
  error: string | null;
}

export interface SerialisedVideo {
  id: string;
  name: string;
  listingId: string;
  listingTitle: string | null;
  style: string;
  aspectRatio: string;
  duration: string;
  status: string;
  width: number;
  height: number;
  durationSeconds: number | null;
  bytes: number | null;
  imageIds: string[];
  error: { code: string; message: string | null } | null;
  createdAt: string;
  completedAt: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  job: SerialisedJob | null;
}
