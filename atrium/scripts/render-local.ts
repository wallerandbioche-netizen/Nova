/**
 * Rend une vidéo à partir d'un dossier de photos, sans passer par l'interface.
 *
 *   npm run render:local -- ./samples/demo-listing --format 9:16
 *
 * C'est le moyen le plus court d'éprouver le moteur sur de vraies photographies.
 */
import path from 'node:path';
import { LocalFolderListingSource } from '../src/lib/listing/folder';
import { newId } from '../src/lib/id';
import { storage } from '../src/lib/storage/local';
import { analyzeImages, curateImages } from '../src/services/imageAnalysis';
import { captionsByPosition, ingestListing } from '../src/services/ingest';
import { exposurePlan } from '../src/lib/video/grade';
import { buildStoryboard, storyboardDuration } from '../src/services/storyboard';
import { generateVideo } from '../src/services/videoGeneration';
import { ROOM_LABELS, VIDEO_FORMATS, type VideoFormat } from '../src/types/domain';

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const folder = path.resolve(process.cwd(), process.argv[2] ?? 'samples/demo-listing');
const requested = flag('format') ?? '9:16';
if (!VIDEO_FORMATS.includes(requested as VideoFormat)) {
  console.error(`Format inconnu : ${requested}. Attendu : ${VIDEO_FORMATS.join(', ')}`);
  process.exit(1);
}
const format = requested as VideoFormat;

const projectId = newId();
const started = Date.now();

console.log(`Dossier   ${folder}`);
console.log(`Format    ${format}\n`);

const listing = await new LocalFolderListingSource().fetchListing(
  { kind: 'folder', path: folder },
  { projectId },
);

const images = await ingestListing(projectId, listing, {
  onProgress: (done, total) => process.stdout.write(`\rPhotos    ${done}/${total}`),
});
process.stdout.write('\n');

await analyzeImages(projectId, images, captionsByPosition(listing), {
  onProgress: (done, total) => process.stdout.write(`\rAnalyse   ${done}/${total}`),
});
process.stdout.write('\n');

curateImages(images);
const scenes = buildStoryboard({ projectId, images, format });

const exposures = exposurePlan(
  scenes.map((scene) => images.find((i) => i.id === scene.imageId)?.analysis?.brightness ?? 0.5),
);
const harmonised = exposures.some((factor) => factor !== 1);

console.log(`\nSéquence  ${scenes.length} plans · ${storyboardDuration(scenes).toFixed(1)} s`);
console.log(
  `Exposition ${harmonised ? 'harmonisée entre les plans' : 'déjà homogène, laissée intacte'}\n`,
);
for (const scene of scenes) {
  const image = images.find((candidate) => candidate.id === scene.imageId)!;
  const analysis = image.analysis!;
  const exposure = exposures[scene.order] ?? 1;
  console.log(
    [
      String(scene.order + 1).padStart(2, ' '),
      path.basename(image.path).padEnd(14),
      ROOM_LABELS[analysis.roomType].padEnd(16),
      `q ${analysis.qualityScore.toFixed(2)}`,
      `c ${analysis.compositionScore.toFixed(2)}`,
      `exp ${exposure === 1 ? '  —' : `×${exposure.toFixed(2)}`}`,
      `${scene.duration.toFixed(1)}s`.padStart(5),
      scene.motionType.padEnd(15),
      scene.transitionType ?? '—',
    ].join('  '),
  );
}

const skipped = images.filter((image) => !image.selected);
if (skipped.length > 0) {
  console.log('\nÉcartées');
  for (const image of skipped) {
    const reason = image.duplicateOf ? 'doublon' : 'score insuffisant';
    console.log(`   ${path.basename(image.path).padEnd(14)} ${reason}`);
  }
}

console.log('\nRendu…');
const video = await generateVideo({
  projectId,
  images,
  scenes,
  format,
  onProgress: (done, total) => process.stdout.write(`\r   plan ${done}/${total}`),
});

console.log(
  `\n\nVidéo     ${storage().resolve(projectId, video.path)}` +
    `\n          ${video.width}×${video.height} · ${video.duration.toFixed(1)} s` +
    ` · ${(video.sizeBytes / 1024 / 1024).toFixed(1)} Mo` +
    `\nDurée     ${((Date.now() - started) / 1000).toFixed(1)} s de traitement`,
);
