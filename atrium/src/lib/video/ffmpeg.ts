import { spawn } from 'node:child_process';
import fs from 'node:fs';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { env } from '@/lib/env';
import { atriumError } from '@/lib/errors';
import { logger } from '@/lib/logger';

const log = logger('ffmpeg');

/**
 * Les binaires embarqués sont importés statiquement : le bundler les traite
 * alors comme des dépendances externes et laisse leur chemin intact. Une
 * résolution dynamique, elle, est réécrite à la compilation et échoue en
 * production.
 */
function usable(candidate: string | null | undefined): string | null {
  return candidate && fs.existsSync(candidate) ? candidate : null;
}

function fromPath(binary: string): string | null {
  for (const dir of (process.env.PATH ?? '').split(':').filter(Boolean)) {
    const candidate = `${dir}/${binary}`;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

let ffmpegCache: string | null = null;
let ffprobeCache: string | null = null;

/** Variable d'environnement, puis binaire embarqué, puis binaire système. */
export function ffmpegPath(): string {
  if (ffmpegCache) return ffmpegCache;
  const resolved = usable(env.ffmpegPath) ?? usable(ffmpegStatic) ?? fromPath('ffmpeg');
  if (!resolved) throw atriumError('FFMPEG_MISSING', 'Aucun binaire ffmpeg trouvé');
  log.debug('ffmpeg résolu', resolved);
  ffmpegCache = resolved;
  return resolved;
}

export function ffprobePath(): string | null {
  ffprobeCache ??= usable(env.ffprobePath) ?? usable(ffprobeStatic.path) ?? fromPath('ffprobe');
  return ffprobeCache;
}

export interface RunOptions {
  signal?: AbortSignal;
  /** Reçoit les lignes d'erreur de ffmpeg, utile pour le diagnostic. */
  onStderr?: (line: string) => void;
}

/**
 * Exécute ffmpeg. La sortie d'erreur est conservée pour le journal serveur,
 * jamais renvoyée à l'utilisateur.
 */
export function runFfmpeg(args: string[], options: RunOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const tail: string[] = [];

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      for (const line of chunk.split('\n')) {
        if (line.trim() === '') continue;
        tail.push(line);
        if (tail.length > 40) tail.shift();
        options.onStderr?.(line);
      }
    });

    const abort = (): void => {
      child.kill('SIGKILL');
    };
    options.signal?.addEventListener('abort', abort, { once: true });

    child.on('error', (error) => {
      options.signal?.removeEventListener('abort', abort);
      reject(atriumError('FFMPEG_MISSING', `ffmpeg n'a pas pu être lancé : ${error.message}`));
    });

    child.on('close', (code) => {
      options.signal?.removeEventListener('abort', abort);
      if (code === 0) resolve();
      else reject(atriumError('RENDER_FAILED', `ffmpeg a terminé en ${code} :\n${tail.join('\n')}`));
    });
  });
}
