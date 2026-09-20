/**
 * Builds the standalone demo bundle: the same components as the Next.js app,
 * bundled as a single static page with hash routing so the interface can be
 * hosted anywhere. Output goes to `demo/dist`.
 *
 *   node demo/build.mjs
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const outDir = resolve(here, 'dist');

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 1. Styles — Tailwind scans the app sources through the same entry the app uses.
const cssEntry = resolve(appRoot, 'src/app/globals.css');
const rawCss = await readFile(cssEntry, 'utf8');
const css = await postcss([tailwind()]).process(rawCss, {
  from: cssEntry,
  to: `${outDir}/app.css`,
});
await writeFile(resolve(outDir, 'app.css'), css.css, 'utf8');

// 2. Script — Next-specific modules are swapped for the demo shims.
const result = await esbuild.build({
  entryPoints: [resolve(here, 'main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  // Kept low so the demo also runs on older mobile browsers.
  target: ['es2017', 'safari13', 'chrome79', 'firefox78'],
  jsx: 'automatic',
  outfile: resolve(outDir, 'app.js'),
  metafile: true,
  loader: { '.css': 'empty' },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.ANTHROPIC_API_KEY': 'undefined',
  },
  tsconfig: resolve(appRoot, 'tsconfig.json'),
  alias: {
    'next/link': resolve(here, 'shims/link.tsx'),
    'next/navigation': resolve(here, 'shims/navigation.ts'),
    'next/dynamic': resolve(here, 'shims/dynamic.ts'),
  },
  plugins: [
    {
      // `server-only` is a build-time guard with no meaning here; the modules
      // that import it are never reachable from the demo entry.
      name: 'server-only-noop',
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({
          path: 'server-only',
          namespace: 'noop',
        }));
        build.onLoad({ filter: /.*/, namespace: 'noop' }, () => ({ contents: '', loader: 'js' }));
      },
    },
  ],
});

const html = await readFile(resolve(here, 'index.html'), 'utf8');
await writeFile(resolve(outDir, 'index.html'), html, 'utf8');

const bytes = Object.values(result.metafile.outputs).reduce((total, out) => total + out.bytes, 0);
console.log(
  `demo built → ${outDir} (${(bytes / 1024).toFixed(0)} KB js, ${(css.css.length / 1024).toFixed(0)} KB css)`,
);
