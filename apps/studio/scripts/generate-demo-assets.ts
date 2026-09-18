/**
 * Renders the local demo photo set into public/demo.
 * Run with `pnpm demo:assets`. The demo importer also calls this lazily on first use.
 */
import { ensureDemoAssets } from '../src/lib/demo/assets';

const started = Date.now();
ensureDemoAssets()
  .then((assets) => {
    console.log(`${assets.length} photos de démonstration prêtes (${Date.now() - started} ms)`);
    for (const asset of assets) {
      console.log(`  ${asset.publicPath}  ${asset.width}x${asset.height}  ${asset.spec.hint}`);
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
