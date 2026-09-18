/** Prints the real length of a generated edit for every style, format and duration preset. */
import { buildStoryboard } from '../src/lib/video/storyboard';
import { STYLE_LIST } from '../src/lib/video/styles';
import type { DurationPreset } from '@prisma/client';

const images = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `i${index}`,
    width: 1920,
    height: 1280,
    focalX: 0.5,
    focalY: 0.5,
    quality: 0.7,
  }));

for (const preset of ['S15', 'S30', 'S45', 'AUTO'] as DurationPreset[]) {
  for (const style of STYLE_LIST) {
    for (const count of [10, 15, 20]) {
      const storyboard = buildStoryboard({
        images: images(count),
        style: style.id,
        aspectRatio: 'VERTICAL',
        duration: preset,
        seed: 42,
      });
      console.log(
        `${preset.padEnd(5)} ${style.id.padEnd(10)} ${String(count).padStart(2)} photos -> ` +
          `${storyboard.durationSeconds.toFixed(1)}s in ${storyboard.scenes.length} plans ` +
          `(${(storyboard.durationSeconds / storyboard.scenes.length).toFixed(1)}s/plan)`,
      );
    }
  }
}
