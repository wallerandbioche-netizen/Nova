/** End-to-end smoke test of the video engine: demo photos -> analysis -> storyboard -> MP4. */
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureDemoAssets } from '../src/lib/demo/assets';
import { HeuristicImageAnalyzer } from '../src/lib/image-analysis/heuristic';
import { selectImages } from '../src/lib/selection/select';
import { buildStoryboard } from '../src/lib/video/storyboard';
import { RemotionRenderer } from '../src/lib/video/renderer';

async function main() {
  const assets = await ensureDemoAssets();
  const analyzer = new HeuristicImageAnalyzer();

  const analyzed = [];
  for (const [index, asset] of assets.entries()) {
    const buffer = await readFile(asset.absolutePath);
    const analysis = await analyzer.analyze({ buffer, hint: asset.spec.hint });
    analyzed.push({ id: asset.spec.id, asset, analysis, sortOrder: index });
  }
  console.log('analysé:', analyzed.map((a) => `${a.id}:${a.analysis.room}:q${a.analysis.quality.toFixed(2)}`).join(' '));

  const selection = selectImages(
    analyzed.map((a) => ({
      id: a.id,
      width: a.analysis.width,
      height: a.analysis.height,
      quality: a.analysis.quality,
      sharpness: a.analysis.sharpness,
      phash: a.analysis.phash,
      room: a.analysis.room,
      sortOrder: a.sortOrder,
    })),
  );
  console.log(`sélection: ${selection.selected.length}/${assets.length}`, selection.selected.map((s) => s.id).join(' '));
  console.log('écartées:', selection.rejected.map((r) => `${r.image.id}(${r.reason})`).join(' ') || 'aucune');

  const byId = new Map(analyzed.map((a) => [a.id, a]));
  const storyboard = buildStoryboard({
    images: selection.selected.map((s) => {
      const entry = byId.get(s.id)!;
      return {
        id: s.id,
        width: entry.analysis.width,
        height: entry.analysis.height,
        focalX: entry.analysis.focalX,
        focalY: entry.analysis.focalY,
        quality: entry.analysis.quality,
      };
    }),
    style: 'CINEMATIC',
    aspectRatio: 'VERTICAL',
    duration: 'S30',
    seed: 42,
  });
  console.log(`storyboard: ${storyboard.scenes.length} plans, ${storyboard.durationSeconds}s, ${storyboard.durationInFrames} images`);
  for (const scene of storyboard.scenes) {
    console.log(`  ${scene.index} ${scene.imageId} ${scene.startSeconds}s +${scene.durationSeconds}s ${scene.animation} <-${scene.transitionIn}`);
  }

  const sources: Record<string, { buffer: Buffer; contentType: string }> = {};
  for (const s of selection.selected) {
    sources[s.id] = {
      buffer: await readFile(byId.get(s.id)!.asset.absolutePath),
      contentType: 'image/jpeg',
    };
  }

  const started = Date.now();
  const renderer = new RemotionRenderer();
  const result = await renderer.render({
    storyboard,
    sources,
    onProgress: ({ renderedFrames, totalFrames }) => {
      if (renderedFrames % 60 === 0) console.log(`  rendu ${renderedFrames}/${totalFrames}`);
    },
  });

  const out = path.resolve(process.cwd(), '.storage/smoke');
  await writeFile(path.join(process.cwd(), 'smoke-video.mp4'), result.video);
  await writeFile(path.join(process.cwd(), 'smoke-poster.jpg'), result.poster);
  console.log(`MP4: ${(result.video.byteLength / 1024 / 1024).toFixed(2)} Mo en ${((Date.now() - started) / 1000).toFixed(1)}s -> ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
