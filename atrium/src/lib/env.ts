import path from 'node:path';
import { VIDEO_FORMATS, type VideoFormat } from '@/types/domain';

function str(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const trimmed = raw.trim().replace(/^"(.*)"$/s, '$1');
  return trimmed === '' ? fallback : trimmed;
}

function int(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(str(name, ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function bool(name: string, fallback: boolean): boolean {
  const raw = str(name, '').toLowerCase();
  if (raw === '') return fallback;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

function oneOf<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const raw = str(name, '') as T;
  return allowed.includes(raw) ? raw : fallback;
}

export type VisionProvider = 'auto' | 'anthropic' | 'heuristic';
export type AirbnbFetchMode = 'demo' | 'live' | 'disabled';

/**
 * Configuration résolue une fois par processus. Aucune valeur n'est requise :
 * les défauts font tourner l'application entièrement hors ligne.
 */
export const env = {
  visionProvider: oneOf<VisionProvider>(
    'VISION_PROVIDER',
    ['auto', 'anthropic', 'heuristic'],
    'auto',
  ),
  anthropicApiKey: str('ANTHROPIC_API_KEY', ''),
  anthropicVisionModel: str('ANTHROPIC_VISION_MODEL', 'claude-sonnet-5'),
  visionBatchSize: int('VISION_BATCH_SIZE', 6, 1, 12),

  airbnbFetchMode: oneOf<AirbnbFetchMode>(
    'AIRBNB_FETCH_MODE',
    ['demo', 'live', 'disabled'],
    'demo',
  ),
  airbnbUserAgent: str(
    'AIRBNB_USER_AGENT',
    'AtriumBot/0.1 (+https://example.com/atrium; contact@example.com)',
  ),
  allowLocalFolderSource: bool('ALLOW_LOCAL_FOLDER_SOURCE', true),

  ffmpegPath: str('FFMPEG_PATH', ''),
  ffprobePath: str('FFPROBE_PATH', ''),

  defaultFormat: oneOf<VideoFormat>('DEFAULT_VIDEO_FORMAT', VIDEO_FORMATS, '9:16'),
  fps: int('VIDEO_FPS', 30, 24, 60),
  crf: int('VIDEO_CRF', 18, 12, 30),
  preset: str('VIDEO_PRESET', 'medium'),

  storageDir: path.resolve(process.cwd(), str('STORAGE_DIR', '.data')),
  jobConcurrency: int('JOB_CONCURRENCY', 1, 1, 4),
} as const;

/** Le provider réellement utilisable compte tenu des clés disponibles. */
export function resolvedVisionProvider(): 'anthropic' | 'heuristic' {
  if (env.visionProvider === 'heuristic') return 'heuristic';
  if (env.visionProvider === 'anthropic') return 'anthropic';
  return env.anthropicApiKey ? 'anthropic' : 'heuristic';
}
