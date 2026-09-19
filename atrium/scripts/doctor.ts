/**
 * Vérifie que l'environnement local peut produire une vidéo.
 *   npm run doctor
 */
import { execFileSync } from 'node:child_process';
import { ffmpegPath, ffprobePath } from '../src/lib/video/ffmpeg';
import { env, resolvedVisionProvider } from '../src/lib/env';

function line(label: string, value: string): void {
  console.log(`${label.padEnd(22)} ${value}`);
}

let failures = 0;

try {
  const binary = ffmpegPath();
  const version = execFileSync(binary, ['-version']).toString().split('\n')[0] ?? '';
  line('ffmpeg', version.replace('ffmpeg version ', ''));

  const filters = execFileSync(binary, ['-hide_banner', '-filters']).toString();
  for (const filter of ['zoompan', 'xfade', 'crop', 'fade']) {
    const present = new RegExp(`\\b${filter}\\b`).test(filters);
    if (!present) failures += 1;
    line(`filtre ${filter}`, present ? 'disponible' : 'MANQUANT');
  }

  const encoders = execFileSync(binary, ['-hide_banner', '-encoders']).toString();
  const x264 = encoders.includes('libx264');
  if (!x264) failures += 1;
  line('encodeur libx264', x264 ? 'disponible' : 'MANQUANT');
} catch (error) {
  failures += 1;
  line('ffmpeg', `introuvable (${String(error)})`);
}

line('ffprobe', ffprobePath() ?? 'absent (facultatif)');
line('analyse des photos', resolvedVisionProvider() === 'anthropic' ? 'modèle de vision' : 'locale (heuristique)');
line('source des annonces', env.airbnbFetchMode);
line('format par défaut', env.defaultFormat);
line('stockage', env.storageDir);

console.log(failures === 0 ? '\nTout est prêt.' : `\n${failures} problème(s) à corriger.`);
process.exit(failures === 0 ? 0 : 1);
