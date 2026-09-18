import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/**
 * Demo photo set.
 *
 * The sandbox this product is developed in has no access to a stock-photo CDN, and shipping
 * scraped listing photos in the repository would be neither legal nor honest. So the demo set is
 * rendered locally: a small vector scene per room, in mixed orientations, with the grain and
 * vignette of a real photograph. It exists to exercise the pipeline (analysis, selection,
 * framing, Ken Burns, transitions, render), not to pretend to be photography.
 *
 * Replace `public/demo/*.jpg` with real, rights-cleared photos to demo the product to a client.
 */

export type DemoScene =
  | 'exterior'
  | 'living'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'terrace'
  | 'pool'
  | 'garden'
  | 'view'
  | 'dining';

export interface DemoPhotoSpec {
  id: string;
  scene: DemoScene;
  /** Caption the importer passes along as a room hint, exactly like a real alt attribute. */
  hint: string;
  width: number;
  height: number;
}

export const DEMO_PHOTOS: DemoPhotoSpec[] = [
  { id: '01-exterior-front', scene: 'exterior', hint: 'Façade de la villa', width: 1920, height: 1280 },
  { id: '02-living-room', scene: 'living', hint: 'Salon lumineux', width: 1920, height: 1280 },
  { id: '03-living-room-alt', scene: 'living', hint: 'Salon, vue canapé', width: 1600, height: 1067 },
  { id: '04-kitchen', scene: 'kitchen', hint: 'Cuisine équipée', width: 1920, height: 1280 },
  { id: '05-dining', scene: 'dining', hint: 'Salle à manger', width: 1600, height: 1067 },
  { id: '06-bedroom-main', scene: 'bedroom', hint: 'Chambre principale', width: 1920, height: 1280 },
  { id: '07-bedroom-second', scene: 'bedroom', hint: 'Deuxième chambre', width: 1280, height: 1600 },
  { id: '08-bathroom', scene: 'bathroom', hint: 'Salle de bain', width: 1280, height: 1600 },
  { id: '09-terrace', scene: 'terrace', hint: 'Terrasse ombragée', width: 1920, height: 1280 },
  { id: '10-pool', scene: 'pool', hint: 'Piscine chauffée', width: 1920, height: 1280 },
  { id: '11-garden', scene: 'garden', hint: 'Jardin méditerranéen', width: 1600, height: 1067 },
  { id: '12-view', scene: 'view', hint: 'Vue sur la vallée', width: 1920, height: 1080 },
  { id: '13-exterior-dusk', scene: 'exterior', hint: 'La villa au crépuscule', width: 1920, height: 1280 },
  { id: '14-view-portrait', scene: 'view', hint: 'Vue depuis la chambre', width: 1080, height: 1440 },
];

export interface DemoAsset {
  spec: DemoPhotoSpec;
  publicPath: string;
  absolutePath: string;
  width: number;
  height: number;
}

function demoDir(): string {
  return path.resolve(process.cwd(), 'public', 'demo');
}

/** Renders any demo photo that is not on disk yet, then returns the whole set. */
export async function ensureDemoAssets(): Promise<DemoAsset[]> {
  const dir = demoDir();
  await mkdir(dir, { recursive: true });

  const assets: DemoAsset[] = [];
  for (const spec of DEMO_PHOTOS) {
    const absolutePath = path.join(dir, `${spec.id}.jpg`);
    if (!existsSync(absolutePath)) {
      await writeFile(absolutePath, await renderDemoPhoto(spec));
    }
    assets.push({
      spec,
      absolutePath,
      publicPath: `/demo/${spec.id}.jpg`,
      width: spec.width,
      height: spec.height,
    });
  }
  return assets;
}

export async function renderDemoPhoto(spec: DemoPhotoSpec): Promise<Buffer> {
  const svg = Buffer.from(sceneSvg(spec));
  const base = sharp(svg, { density: 96 }).resize(spec.width, spec.height, { fit: 'fill' });

  // Grain + vignette: without them a flat vector render makes the Ken Burns move hard to read.
  const grain = await sharp({
    create: {
      width: spec.width,
      height: spec.height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
      noise: { type: 'gaussian', mean: 128, sigma: 9 },
    },
  })
    .png()
    .toBuffer();

  const vignette = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.width}" height="${spec.height}">
      <defs>
        <radialGradient id="v" cx="50%" cy="48%" r="75%">
          <stop offset="55%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.34"/>
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>`,
  );

  return base
    .composite([
      { input: grain, blend: 'overlay' },
      { input: vignette, blend: 'over' },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
}

/* -------------------------------------------------------------------------- */
/* Scenes                                                                      */
/* -------------------------------------------------------------------------- */

function sceneSvg(spec: DemoPhotoSpec): string {
  const w = 1200;
  const h = Math.round((spec.height / spec.width) * 1200);
  const body = SCENES[spec.scene](w, h, spec.id);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

/** Cheap deterministic jitter so two photos of the same room are not identical. */
function variant(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 100) / 100;
}

const SCENES: Record<DemoScene, (w: number, h: number, id: string) => string> = {
  exterior: (w, h, id) => {
    const dusk = id.includes('dusk');
    const sky = dusk
      ? gradient('sky', '#2b3a67', '#e9856b')
      : gradient('sky', '#9fc7e8', '#e8f2fb');
    const wall = dusk ? '#e8d9c5' : '#f3ece1';
    const windowFill = dusk ? '#ffd79a' : '#5d7d97';
    return `
      ${defs(sky + gradient('ground', dusk ? '#4a5a3d' : '#7e9b63', dusk ? '#33402d' : '#5d7a49'))}
      <rect width="${w}" height="${h * 0.62}" fill="url(#sky)"/>
      <rect y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="url(#ground)"/>
      <g>
        <rect x="${w * 0.12}" y="${h * 0.28}" width="${w * 0.68}" height="${h * 0.42}" fill="${wall}"/>
        <polygon points="${w * 0.08},${h * 0.29} ${w * 0.46},${h * 0.12} ${w * 0.84},${h * 0.29}" fill="${dusk ? '#4b4038' : '#6d5a4c'}"/>
        ${[0.18, 0.31, 0.44, 0.63].map((x) => `<rect x="${w * x}" y="${h * 0.37}" width="${w * 0.1}" height="${h * 0.14}" fill="${windowFill}" stroke="#ffffff" stroke-width="6"/>`).join('')}
        <rect x="${w * 0.54}" y="${h * 0.52}" width="${w * 0.1}" height="${h * 0.18}" fill="${dusk ? '#8a6a4b' : '#6b5238'}"/>
      </g>
      <ellipse cx="${w * 0.9}" cy="${h * 0.6}" rx="${w * 0.12}" ry="${h * 0.16}" fill="${dusk ? '#2f3d2c' : '#4f7040'}"/>
      <rect y="${h * 0.86}" width="${w}" height="${h * 0.14}" fill="${dusk ? '#3a3a38' : '#b9b3a6'}"/>`;
  },

  living: (w, h, id) => {
    const warm = variant(id) > 0.5;
    return `
      ${defs(gradient('wall', warm ? '#f6f1ea' : '#eef1f4', '#dfe3e6') + gradient('win', '#cfe4f5', '#f7fbff'))}
      <rect width="${w}" height="${h}" fill="url(#wall)"/>
      <rect x="${w * 0.58}" y="${h * 0.12}" width="${w * 0.36}" height="${h * 0.55}" fill="url(#win)" stroke="#cbd2d8" stroke-width="8"/>
      <line x1="${w * 0.76}" y1="${h * 0.12}" x2="${w * 0.76}" y2="${h * 0.67}" stroke="#cbd2d8" stroke-width="6"/>
      <rect y="${h * 0.72}" width="${w}" height="${h * 0.28}" fill="${warm ? '#c9a27a' : '#bfa285'}"/>
      <rect x="${w * 0.06}" y="${h * 0.48}" width="${w * 0.42}" height="${h * 0.26}" rx="18" fill="${warm ? '#8e9b8a' : '#6f7d8c'}"/>
      <rect x="${w * 0.1}" y="${h * 0.42}" width="${w * 0.12}" height="${h * 0.1}" rx="10" fill="${warm ? '#c8ccbf' : '#aab6c2'}"/>
      <rect x="${w * 0.26}" y="${h * 0.42}" width="${w * 0.12}" height="${h * 0.1}" rx="10" fill="#e6e2d8"/>
      <rect x="${w * 0.14}" y="${h * 0.78}" width="${w * 0.4}" height="${h * 0.12}" rx="8" fill="#8a6b4e"/>
      <ellipse cx="${w * 0.5}" cy="${h * 0.93}" rx="${w * 0.4}" ry="${h * 0.06}" fill="#d8cfc2" opacity="0.7"/>`;
  },

  kitchen: (w, h) => `
      ${defs(gradient('k', '#f7f7f5', '#e2e6e8'))}
      <rect width="${w}" height="${h}" fill="url(#k)"/>
      <rect x="0" y="${h * 0.55}" width="${w}" height="${h * 0.1}" fill="#3f4a52"/>
      <rect x="0" y="${h * 0.65}" width="${w}" height="${h * 0.35}" fill="#e9e4dc"/>
      ${[0.02, 0.2, 0.38, 0.56, 0.74].map((x) => `<rect x="${w * x}" y="${h * 0.67}" width="${w * 0.16}" height="${h * 0.3}" fill="#d9d2c7" stroke="#c3bbae" stroke-width="4"/>`).join('')}
      ${[0.06, 0.28, 0.5].map((x) => `<rect x="${w * x}" y="${h * 0.16}" width="${w * 0.14}" height="${h * 0.3}" fill="#cfd6da" stroke="#b7c0c6" stroke-width="4"/>`).join('')}
      <rect x="${w * 0.72}" y="${h * 0.12}" width="${w * 0.24}" height="${h * 0.42}" fill="#b9c7cf"/>
      <circle cx="${w * 0.46}" cy="${h * 0.52}" r="${h * 0.035}" fill="#9aa3a8"/>`,

  dining: (w, h) => `
      ${defs(gradient('d', '#f2ede6', '#ddd6cc'))}
      <rect width="${w}" height="${h}" fill="url(#d)"/>
      <rect x="${w * 0.05}" y="${h * 0.1}" width="${w * 0.34}" height="${h * 0.5}" fill="#cfe3f2" stroke="#c0c8ce" stroke-width="8"/>
      <rect y="${h * 0.7}" width="${w}" height="${h * 0.3}" fill="#b98f66"/>
      <rect x="${w * 0.2}" y="${h * 0.56}" width="${w * 0.6}" height="${h * 0.08}" rx="6" fill="#7a5638"/>
      ${[0.24, 0.38, 0.52, 0.66].map((x) => `<rect x="${w * x}" y="${h * 0.64}" width="${w * 0.06}" height="${h * 0.22}" fill="#5f4530"/>`).join('')}
      <ellipse cx="${w * 0.5}" cy="${h * 0.2}" rx="${w * 0.08}" ry="${h * 0.04}" fill="#e3c88b"/>`,

  bedroom: (w, h, id) => {
    const portrait = h > w;
    return `
      ${defs(gradient('b', '#efeae4', '#dcd5cc') + gradient('bw', '#d8e8f5', '#f6fbff'))}
      <rect width="${w}" height="${h}" fill="url(#b)"/>
      <rect x="${portrait ? w * 0.08 : w * 0.62}" y="${h * 0.1}" width="${w * 0.3}" height="${h * 0.34}" fill="url(#bw)" stroke="#c9cfd4" stroke-width="8"/>
      <rect y="${h * 0.74}" width="${w}" height="${h * 0.26}" fill="#bfa587"/>
      <rect x="${w * 0.14}" y="${h * 0.48}" width="${w * 0.62}" height="${h * 0.3}" rx="14" fill="#f3f0ea"/>
      <rect x="${w * 0.14}" y="${h * 0.48}" width="${w * 0.62}" height="${h * 0.09}" rx="10" fill="${variant(id) > 0.5 ? '#8fa3a8' : '#a8968a'}"/>
      <rect x="${w * 0.2}" y="${h * 0.42}" width="${w * 0.2}" height="${h * 0.08}" rx="10" fill="#ffffff"/>
      <rect x="${w * 0.46}" y="${h * 0.42}" width="${w * 0.2}" height="${h * 0.08}" rx="10" fill="#ffffff"/>
      <rect x="${w * 0.8}" y="${h * 0.6}" width="${w * 0.12}" height="${h * 0.18}" fill="#9c8368"/>`;
  },

  bathroom: (w, h) => `
      ${defs(gradient('ba', '#eef3f4', '#d5dee1'))}
      <rect width="${w}" height="${h}" fill="url(#ba)"/>
      ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${(h * i) / 8}" x2="${w}" y2="${(h * i) / 8}" stroke="#ffffff" stroke-width="3" opacity="0.7"/>`).join('')}
      <rect x="${w * 0.1}" y="${h * 0.52}" width="${w * 0.5}" height="${h * 0.26}" rx="26" fill="#ffffff" stroke="#cdd6d9" stroke-width="6"/>
      <rect x="${w * 0.68}" y="${h * 0.16}" width="${w * 0.24}" height="${h * 0.3}" rx="6" fill="#c4d3d8"/>
      <rect x="${w * 0.7}" y="${h * 0.52}" width="${w * 0.22}" height="${h * 0.3}" fill="#e6ecee" stroke="#cdd6d9" stroke-width="5"/>
      <circle cx="${w * 0.35}" cy="${h * 0.44}" r="${h * 0.03}" fill="#b6c3c7"/>
      <rect y="${h * 0.84}" width="${w}" height="${h * 0.16}" fill="#c9d1d3"/>`,

  terrace: (w, h) => `
      ${defs(gradient('t', '#a7cde8', '#eaf4fb') + gradient('tf', '#c9b394', '#a68b6b'))}
      <rect width="${w}" height="${h * 0.5}" fill="url(#t)"/>
      <rect y="${h * 0.5}" width="${w}" height="${h * 0.5}" fill="url(#tf)"/>
      <rect x="0" y="${h * 0.44}" width="${w}" height="${h * 0.06}" fill="#6f8a55"/>
      <rect x="${w * 0.06}" y="${h * 0.04}" width="${w * 0.88}" height="${h * 0.08}" fill="#e7e0d3"/>
      ${[0.1, 0.46, 0.84].map((x) => `<rect x="${w * x}" y="${h * 0.12}" width="${w * 0.03}" height="${h * 0.4}" fill="#e7e0d3"/>`).join('')}
      <rect x="${w * 0.18}" y="${h * 0.56}" width="${w * 0.3}" height="${h * 0.12}" rx="10" fill="#7d8a76"/>
      <rect x="${w * 0.56}" y="${h * 0.58}" width="${w * 0.26}" height="${h * 0.1}" rx="8" fill="#5d6b5a"/>
      <ellipse cx="${w * 0.5}" cy="${h * 0.95}" rx="${w * 0.45}" ry="${h * 0.05}" fill="#8e7758" opacity="0.5"/>`,

  pool: (w, h) => `
      ${defs(gradient('p', '#8fc6e6', '#e6f3fb') + gradient('water', '#2f8fc0', '#7fd0e8'))}
      <rect width="${w}" height="${h * 0.38}" fill="url(#p)"/>
      <rect y="${h * 0.38}" width="${w}" height="${h * 0.12}" fill="#7f9c63"/>
      <rect y="${h * 0.5}" width="${w}" height="${h * 0.5}" fill="#ddd3c2"/>
      <rect x="${w * 0.08}" y="${h * 0.56}" width="${w * 0.84}" height="${h * 0.34}" rx="12" fill="url(#water)"/>
      ${Array.from({ length: 6 }, (_, i) => `<rect x="${w * 0.1}" y="${h * (0.6 + i * 0.05)}" width="${w * 0.8}" height="4" fill="#ffffff" opacity="0.28"/>`).join('')}
      <rect x="${w * 0.06}" y="${h * 0.42}" width="${w * 0.16}" height="${h * 0.08}" rx="6" fill="#f0ece3"/>
      <ellipse cx="${w * 0.86}" cy="${h * 0.4}" rx="${w * 0.1}" ry="${h * 0.1}" fill="#4f7040"/>`,

  garden: (w, h) => `
      ${defs(gradient('g', '#b7d8ef', '#edf6fc') + gradient('grass', '#7fa35c', '#4f7040'))}
      <rect width="${w}" height="${h * 0.34}" fill="url(#g)"/>
      <rect y="${h * 0.34}" width="${w}" height="${h * 0.66}" fill="url(#grass)"/>
      ${[0.12, 0.34, 0.62, 0.86].map((x, i) => `<ellipse cx="${w * x}" cy="${h * (0.3 + i * 0.03)}" rx="${w * 0.1}" ry="${h * 0.12}" fill="#3f5f34"/>`).join('')}
      <path d="M0 ${h * 0.82} Q ${w * 0.5} ${h * 0.66} ${w} ${h * 0.86} L ${w} ${h} L 0 ${h} Z" fill="#cbbfa6"/>
      ${[0.2, 0.5, 0.78].map((x) => `<rect x="${w * x}" y="${h * 0.5}" width="${w * 0.05}" height="${h * 0.16}" fill="#6b5a3f"/>`).join('')}`,

  view: (w, h) => `
      ${defs(gradient('v1', '#f3c78a', '#9ec9e8') + gradient('v2', '#5f7d8c', '#31485a') + gradient('v3', '#7aa0b5', '#b9d6e6'))}
      <rect width="${w}" height="${h * 0.58}" fill="url(#v1)"/>
      <polygon points="0,${h * 0.58} ${w * 0.3},${h * 0.3} ${w * 0.55},${h * 0.58}" fill="url(#v2)"/>
      <polygon points="${w * 0.35},${h * 0.58} ${w * 0.68},${h * 0.24} ${w},${h * 0.58}" fill="#44607a"/>
      <rect y="${h * 0.58}" width="${w}" height="${h * 0.42}" fill="url(#v3)"/>
      ${Array.from({ length: 5 }, (_, i) => `<rect x="0" y="${h * (0.64 + i * 0.07)}" width="${w}" height="3" fill="#ffffff" opacity="0.25"/>`).join('')}
      <circle cx="${w * 0.8}" cy="${h * 0.16}" r="${h * 0.06}" fill="#fff4dd" opacity="0.9"/>`,
};

function defs(inner: string): string {
  return `<defs>${inner}</defs>`;
}

function gradient(id: string, from: string, to: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient>`;
}
