/**
 * Génère (ou complète) le jeu de photos de démonstration.
 *   npm run samples -- [dossier]
 */
import path from 'node:path';
import { ensureSamplePhotos } from '../src/lib/samples/generate';

const target = path.resolve(process.cwd(), process.argv[2] ?? 'samples/demo-listing');

const photos = await ensureSamplePhotos(target);
console.log(`${photos.length} photos disponibles dans ${target}`);
