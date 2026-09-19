import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { SAMPLE_SCENES, type SampleScene } from './scenes';

/**
 * Jeu de photos de démonstration entièrement généré en local (SVG → JPEG).
 * Il permet de faire tourner tout le pipeline — analyse, cadrage, mouvements,
 * encodage — sans aucun accès réseau ni photo tierce.
 */

/** Générateur pseudo-aléatoire déterministe : même annonce à chaque exécution. */
function rng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100_000) / 100_000;
  };
}

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const r2 = (value: number): string => value.toFixed(2);

function interior(scene: SampleScene): string {
  const { width: w, height: h, palette: p, subject } = scene;
  const drift = scene.drift ?? 0;
  const horizon = h * (0.56 + drift);
  const sx = subject.x * w + drift * w;
  const random = rng(hashSeed(scene.file));
  const pieces: string[] = [];

  // Sol en perspective.
  pieces.push(
    `<polygon points="0,${r2(horizon)} ${w},${r2(horizon)} ${w},${h} 0,${h}" fill="url(#floor)"/>`,
  );
  pieces.push(
    `<polygon points="${r2(w * 0.18)},${r2(horizon)} ${r2(w * 0.82)},${r2(horizon)} ${w},${h} 0,${h}" fill="${p.floorLow}" opacity="0.18"/>`,
  );

  // Baie vitrée : source de lumière et point de fuite du décor.
  const winW = w * 0.3;
  const winX = subject.x > 0.5 ? w * 0.08 : w * 0.62;
  const winY = h * 0.12;
  const winH = horizon - winY - h * 0.02;
  pieces.push(
    `<rect x="${r2(winX)}" y="${r2(winY)}" width="${r2(winW)}" height="${r2(winH)}" rx="6" fill="url(#daylight)"/>`,
    `<rect x="${r2(winX)}" y="${r2(winY)}" width="${r2(winW)}" height="${r2(winH)}" rx="6" fill="none" stroke="${p.accent}" stroke-width="${r2(w * 0.004)}" opacity="0.55"/>`,
    `<line x1="${r2(winX + winW / 2)}" y1="${r2(winY)}" x2="${r2(winX + winW / 2)}" y2="${r2(winY + winH)}" stroke="${p.accent}" stroke-width="${r2(w * 0.003)}" opacity="0.4"/>`,
    `<ellipse cx="${r2(winX + winW / 2)}" cy="${r2(horizon + h * 0.12)}" rx="${r2(winW * 0.9)}" ry="${r2(h * 0.09)}" fill="#ffffff" opacity="0.16" filter="url(#soft)"/>`,
  );

  const floorY = horizon + h * 0.04;

  if (scene.room === 'living_room') {
    const sofaW = w * 0.42;
    const sofaH = h * 0.17;
    const sofaX = sx - sofaW / 2;
    const sofaY = floorY + h * 0.06;
    pieces.push(
      `<ellipse cx="${r2(sx)}" cy="${r2(sofaY + sofaH * 1.05)}" rx="${r2(sofaW * 0.78)}" ry="${r2(h * 0.055)}" fill="${p.floorLow}" opacity="0.3" filter="url(#soft)"/>`,
      `<rect x="${r2(sofaX)}" y="${r2(sofaY)}" width="${r2(sofaW)}" height="${r2(sofaH)}" rx="${r2(h * 0.03)}" fill="${p.wallLow}"/>`,
      `<rect x="${r2(sofaX + sofaW * 0.04)}" y="${r2(sofaY - h * 0.07)}" width="${r2(sofaW * 0.92)}" height="${r2(h * 0.1)}" rx="${r2(h * 0.028)}" fill="${p.wall}"/>`,
      `<rect x="${r2(sofaX + sofaW * 0.1)}" y="${r2(sofaY - h * 0.05)}" width="${r2(sofaW * 0.16)}" height="${r2(h * 0.07)}" rx="${r2(h * 0.018)}" fill="${p.warm}" opacity="0.85"/>`,
      `<rect x="${r2(sofaX + sofaW * 0.7)}" y="${r2(sofaY - h * 0.05)}" width="${r2(sofaW * 0.16)}" height="${r2(h * 0.07)}" rx="${r2(h * 0.018)}" fill="${p.accent}" opacity="0.35"/>`,
      `<ellipse cx="${r2(sx - w * 0.03)}" cy="${r2(sofaY + sofaH * 1.35)}" rx="${r2(sofaW * 0.6)}" ry="${r2(h * 0.045)}" fill="${p.accent}" opacity="0.14"/>`,
      `<rect x="${r2(sx - w * 0.07)}" y="${r2(sofaY + sofaH * 1.12)}" width="${r2(w * 0.14)}" height="${r2(h * 0.03)}" rx="${r2(h * 0.008)}" fill="${p.deep}" opacity="0.55"/>`,
    );
    // Cheminée, côté opposé à la baie.
    const fx = subject.x > 0.5 ? w * 0.12 : w * 0.72;
    pieces.push(
      `<rect x="${r2(fx)}" y="${r2(horizon - h * 0.3)}" width="${r2(w * 0.16)}" height="${r2(h * 0.34)}" fill="${p.wallLow}"/>`,
      `<rect x="${r2(fx + w * 0.035)}" y="${r2(horizon - h * 0.16)}" width="${r2(w * 0.09)}" height="${r2(h * 0.14)}" rx="4" fill="${p.deep}"/>`,
      `<ellipse cx="${r2(fx + w * 0.08)}" cy="${r2(horizon - h * 0.05)}" rx="${r2(w * 0.035)}" ry="${r2(h * 0.04)}" fill="${p.warm}" opacity="0.9" filter="url(#soft)"/>`,
    );
  } else if (scene.room === 'kitchen') {
    const isleW = w * 0.46;
    const isleX = sx - isleW / 2;
    const isleY = floorY + h * 0.08;
    pieces.push(
      `<rect x="${r2(w * 0.06)}" y="${r2(horizon - h * 0.26)}" width="${r2(w * 0.4)}" height="${r2(h * 0.1)}" fill="${p.wallLow}"/>`,
      `<rect x="${r2(w * 0.06)}" y="${r2(horizon - h * 0.1)}" width="${r2(w * 0.4)}" height="${r2(h * 0.1)}" fill="${p.accent}" opacity="0.5"/>`,
      `<ellipse cx="${r2(sx)}" cy="${r2(isleY + h * 0.2)}" rx="${r2(isleW * 0.7)}" ry="${r2(h * 0.05)}" fill="${p.floorLow}" opacity="0.32" filter="url(#soft)"/>`,
      `<rect x="${r2(isleX)}" y="${r2(isleY)}" width="${r2(isleW)}" height="${r2(h * 0.2)}" rx="${r2(h * 0.012)}" fill="${p.deep}" opacity="0.82"/>`,
      `<rect x="${r2(isleX - w * 0.012)}" y="${r2(isleY - h * 0.02)}" width="${r2(isleW + w * 0.024)}" height="${r2(h * 0.028)}" rx="${r2(h * 0.012)}" fill="${p.wall}"/>`,
    );
    for (let i = 0; i < 3; i += 1) {
      const lx = sx - isleW * 0.3 + (isleW * 0.3 * i);
      pieces.push(
        `<line x1="${r2(lx)}" y1="${r2(h * 0.02)}" x2="${r2(lx)}" y2="${r2(isleY - h * 0.16)}" stroke="${p.accent}" stroke-width="${r2(w * 0.002)}" opacity="0.6"/>`,
        `<circle cx="${r2(lx)}" cy="${r2(isleY - h * 0.13)}" r="${r2(w * 0.022)}" fill="${p.warm}" opacity="0.95" filter="url(#soft)"/>`,
      );
    }
  } else if (scene.room === 'bedroom') {
    const bedW = w * 0.52;
    const bedX = sx - bedW / 2;
    const bedY = floorY + h * 0.08;
    pieces.push(
      `<rect x="${r2(bedX + bedW * 0.08)}" y="${r2(horizon - h * 0.24)}" width="${r2(bedW * 0.84)}" height="${r2(h * 0.26)}" rx="${r2(h * 0.02)}" fill="${p.wallLow}"/>`,
      `<ellipse cx="${r2(sx)}" cy="${r2(bedY + h * 0.22)}" rx="${r2(bedW * 0.66)}" ry="${r2(h * 0.05)}" fill="${p.floorLow}" opacity="0.3" filter="url(#soft)"/>`,
      `<rect x="${r2(bedX)}" y="${r2(bedY)}" width="${r2(bedW)}" height="${r2(h * 0.2)}" rx="${r2(h * 0.02)}" fill="${p.wall}"/>`,
      `<rect x="${r2(bedX)}" y="${r2(bedY + h * 0.11)}" width="${r2(bedW)}" height="${r2(h * 0.09)}" rx="${r2(h * 0.016)}" fill="${p.warm}" opacity="0.5"/>`,
      `<rect x="${r2(bedX + bedW * 0.08)}" y="${r2(bedY - h * 0.035)}" width="${r2(bedW * 0.34)}" height="${r2(h * 0.06)}" rx="${r2(h * 0.02)}" fill="#ffffff" opacity="0.95"/>`,
      `<rect x="${r2(bedX + bedW * 0.56)}" y="${r2(bedY - h * 0.035)}" width="${r2(bedW * 0.34)}" height="${r2(h * 0.06)}" rx="${r2(h * 0.02)}" fill="#ffffff" opacity="0.88"/>`,
      `<circle cx="${r2(bedX - w * 0.05)}" cy="${r2(bedY + h * 0.02)}" r="${r2(w * 0.026)}" fill="${p.warm}" opacity="0.9" filter="url(#soft)"/>`,
    );
  } else if (scene.room === 'bathroom') {
    const tubW = w * 0.44;
    const tubX = sx - tubW / 2;
    const tubY = floorY + h * 0.1;
    pieces.push(
      `<rect x="${r2(w * 0.08)}" y="${r2(horizon - h * 0.3)}" width="${r2(w * 0.3)}" height="${r2(h * 0.2)}" rx="${r2(w * 0.02)}" fill="url(#daylight)" opacity="0.7"/>`,
      `<ellipse cx="${r2(sx)}" cy="${r2(tubY + h * 0.14)}" rx="${r2(tubW * 0.62)}" ry="${r2(h * 0.04)}" fill="${p.floorLow}" opacity="0.3" filter="url(#soft)"/>`,
      `<rect x="${r2(tubX)}" y="${r2(tubY)}" width="${r2(tubW)}" height="${r2(h * 0.13)}" rx="${r2(h * 0.055)}" fill="#ffffff"/>`,
      `<rect x="${r2(tubX + tubW * 0.05)}" y="${r2(tubY + h * 0.02)}" width="${r2(tubW * 0.9)}" height="${r2(h * 0.06)}" rx="${r2(h * 0.03)}" fill="${p.floor}" opacity="0.35"/>`,
    );
  } else {
    // Détail : une table, un vase, une branche.
    const tx = sx;
    pieces.push(
      `<ellipse cx="${r2(tx)}" cy="${r2(floorY + h * 0.2)}" rx="${r2(w * 0.24)}" ry="${r2(h * 0.045)}" fill="${p.floorLow}" opacity="0.3" filter="url(#soft)"/>`,
      `<rect x="${r2(tx - w * 0.22)}" y="${r2(floorY + h * 0.12)}" width="${r2(w * 0.44)}" height="${r2(h * 0.03)}" rx="${r2(h * 0.012)}" fill="${p.floorLow}"/>`,
      `<path d="M ${r2(tx - w * 0.05)} ${r2(floorY + h * 0.12)} q ${r2(w * 0.05)} ${r2(-h * 0.1)} ${r2(w * 0.1)} 0 z" fill="${p.wall}"/>`,
    );
    for (let i = 0; i < 6; i += 1) {
      const angle = -1.4 + random() * 1.6;
      const len = h * (0.1 + random() * 0.1);
      pieces.push(
        `<line x1="${r2(tx)}" y1="${r2(floorY + h * 0.06)}" x2="${r2(tx + Math.cos(angle) * len)}" y2="${r2(floorY + h * 0.06 - Math.abs(Math.sin(angle)) * len)}" stroke="${p.accent}" stroke-width="${r2(w * 0.004)}" opacity="0.7"/>`,
      );
    }
  }

  // Plante d'appoint, côté baie.
  const px = winX + winW * (subject.x > 0.5 ? 0.15 : 0.85);
  pieces.push(
    `<rect x="${r2(px - w * 0.02)}" y="${r2(floorY + h * 0.08)}" width="${r2(w * 0.04)}" height="${r2(h * 0.07)}" rx="${r2(w * 0.008)}" fill="${p.floorLow}"/>`,
  );
  for (let i = 0; i < 7; i += 1) {
    const angle = -1.9 + (i / 6) * 2.1;
    const len = h * (0.1 + random() * 0.08);
    pieces.push(
      `<ellipse cx="${r2(px + Math.cos(angle) * len * 0.75)}" cy="${r2(floorY + h * 0.07 - Math.abs(Math.sin(angle)) * len)}" rx="${r2(w * 0.024)}" ry="${r2(h * 0.011)}" fill="#4f6b45" opacity="0.82" transform="rotate(${r2((angle * 180) / Math.PI + 90)} ${r2(px)} ${r2(floorY + h * 0.07)})"/>`,
    );
  }

  return pieces.join('');
}

function outdoor(scene: SampleScene): string {
  const { width: w, height: h, palette: p, subject } = scene;
  const drift = scene.drift ?? 0;
  const horizon = h * (scene.room === 'view' ? 0.46 : 0.54) + drift * h;
  const random = rng(hashSeed(scene.file));
  const pieces: string[] = [`<rect width="${w}" height="${r2(horizon)}" fill="url(#sky)"/>`];

  // Reliefs lointains.
  for (let layer = 0; layer < 3; layer += 1) {
    const base = horizon - h * 0.01 * layer;
    const amp = h * (0.08 - layer * 0.02);
    let d = `M 0 ${r2(base)}`;
    for (let x = 0; x <= w; x += w / 8) {
      d += ` Q ${r2(x + w / 16)} ${r2(base - amp * (0.4 + random()))} ${r2(x + w / 8)} ${r2(base)}`;
    }
    d += ` L ${w} ${r2(horizon)} L 0 ${r2(horizon)} Z`;
    pieces.push(`<path d="${d}" fill="${p.accent}" opacity="${r2(0.12 + layer * 0.08)}"/>`);
  }

  pieces.push(
    `<rect y="${r2(horizon)}" width="${w}" height="${r2(h - horizon)}" fill="url(#ground)"/>`,
  );

  if (scene.room === 'exterior' || scene.room === 'terrace') {
    const bx = subject.x * w - w * 0.22;
    const by = horizon - h * 0.3;
    pieces.push(
      `<rect x="${r2(bx)}" y="${r2(by)}" width="${r2(w * 0.44)}" height="${r2(h * 0.34)}" fill="${p.wall}"/>`,
      `<polygon points="${r2(bx - w * 0.02)},${r2(by)} ${r2(bx + w * 0.46)},${r2(by)} ${r2(bx + w * 0.42)},${r2(by - h * 0.04)} ${r2(bx + w * 0.02)},${r2(by - h * 0.04)}" fill="${p.wallLow}"/>`,
    );
    for (let i = 0; i < 3; i += 1) {
      pieces.push(
        `<rect x="${r2(bx + w * (0.05 + i * 0.13))}" y="${r2(by + h * 0.07)}" width="${r2(w * 0.08)}" height="${r2(h * 0.15)}" rx="3" fill="url(#daylight)" opacity="0.9"/>`,
      );
    }
    if (scene.room === 'terrace') {
      const tx = subject.x * w;
      pieces.push(
        `<rect x="${r2(tx - w * 0.14)}" y="${r2(horizon + h * 0.08)}" width="${r2(w * 0.28)}" height="${r2(h * 0.025)}" rx="${r2(h * 0.012)}" fill="${p.warm}"/>`,
        `<rect x="${r2(tx - w * 0.11)}" y="${r2(horizon + h * 0.1)}" width="${r2(w * 0.012)}" height="${r2(h * 0.1)}" fill="${p.floorLow}"/>`,
        `<rect x="${r2(tx + w * 0.1)}" y="${r2(horizon + h * 0.1)}" width="${r2(w * 0.012)}" height="${r2(h * 0.1)}" fill="${p.floorLow}"/>`,
        `<ellipse cx="${r2(tx)}" cy="${r2(horizon + h * 0.22)}" rx="${r2(w * 0.2)}" ry="${r2(h * 0.03)}" fill="${p.deep}" opacity="0.2" filter="url(#soft)"/>`,
      );
    }
  }

  // Végétation.
  const trees = scene.room === 'garden' ? 9 : 4;
  for (let i = 0; i < trees; i += 1) {
    const tx = w * (0.05 + random() * 0.9);
    const scale = 0.7 + random() * 0.7;
    const ty = horizon + h * 0.02 + random() * h * 0.1;
    pieces.push(
      `<rect x="${r2(tx - w * 0.006 * scale)}" y="${r2(ty - h * 0.1 * scale)}" width="${r2(w * 0.012 * scale)}" height="${r2(h * 0.1 * scale)}" fill="#5a4a36" opacity="0.8"/>`,
      `<ellipse cx="${r2(tx)}" cy="${r2(ty - h * 0.13 * scale)}" rx="${r2(w * 0.05 * scale)}" ry="${r2(h * 0.06 * scale)}" fill="#4d6b3c" opacity="0.85"/>`,
      `<ellipse cx="${r2(tx + w * 0.02 * scale)}" cy="${r2(ty - h * 0.17 * scale)}" rx="${r2(w * 0.038 * scale)}" ry="${r2(h * 0.045 * scale)}" fill="#5d7d48" opacity="0.8"/>`,
    );
  }

  return pieces.join('');
}

function waterScene(scene: SampleScene): string {
  const { width: w, height: h, palette: p, subject } = scene;
  const horizon = h * 0.4;
  const poolTop = h * 0.52;
  const random = rng(hashSeed(scene.file));
  const pieces: string[] = [
    `<rect width="${w}" height="${r2(horizon)}" fill="url(#sky)"/>`,
    `<rect y="${r2(horizon)}" width="${w}" height="${r2(poolTop - horizon)}" fill="${p.wall}"/>`,
    `<rect y="${r2(poolTop)}" width="${w}" height="${r2(h - poolTop)}" fill="url(#pool)"/>`,
  ];

  for (let i = 0; i < 16; i += 1) {
    const y = poolTop + (h - poolTop) * ((i + 1) / 17);
    const amplitude = w * (0.04 + random() * 0.14);
    const x = w * random();
    pieces.push(
      `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(amplitude)}" height="${r2(h * 0.006)}" rx="${r2(h * 0.003)}" fill="#ffffff" opacity="${r2(0.08 + random() * 0.18)}"/>`,
    );
  }

  const lx = subject.x * w;
  pieces.push(
    `<rect x="${r2(lx - w * 0.2)}" y="${r2(horizon - h * 0.14)}" width="${r2(w * 0.4)}" height="${r2(h * 0.14)}" fill="${p.wall}" opacity="0.95"/>`,
    `<rect x="${r2(lx - w * 0.16)}" y="${r2(horizon - h * 0.1)}" width="${r2(w * 0.12)}" height="${r2(h * 0.09)}" fill="url(#daylight)" opacity="0.85"/>`,
    `<rect x="${r2(w * 0.06)}" y="${r2(poolTop - h * 0.06)}" width="${r2(w * 0.16)}" height="${r2(h * 0.03)}" rx="${r2(h * 0.014)}" fill="#ffffff" opacity="0.9"/>`,
    `<rect x="${r2(w * 0.26)}" y="${r2(poolTop - h * 0.06)}" width="${r2(w * 0.16)}" height="${r2(h * 0.03)}" rx="${r2(h * 0.014)}" fill="#ffffff" opacity="0.9"/>`,
  );

  return pieces.join('');
}

export function renderSceneSvg(scene: SampleScene): string {
  const { width: w, height: h, palette: p } = scene;
  const body =
    scene.kind === 'interior'
      ? interior(scene)
      : scene.kind === 'water'
        ? waterScene(scene)
        : outdoor(scene);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.wall}"/><stop offset="100%" stop-color="${p.wallLow}"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.floor}"/><stop offset="100%" stop-color="${p.floorLow}"/>
    </linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.skyLow}"/><stop offset="100%" stop-color="${p.sky}"/>
    </linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.floor}"/><stop offset="100%" stop-color="${p.floorLow}"/>
    </linearGradient>
    <linearGradient id="pool" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.floor}"/><stop offset="100%" stop-color="${p.floorLow}"/>
    </linearGradient>
    <linearGradient id="daylight" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/><stop offset="60%" stop-color="${p.sky}"/><stop offset="100%" stop-color="${p.skyLow}"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="48%" r="72%">
      <stop offset="55%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.3"/>
    </radialGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${r2(Math.max(w, h) * 0.012)}"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#wall)"/>
  ${body}
  <rect width="${w}" height="${h}" fill="url(#vignette)"/>
</svg>`;
}

export interface GeneratedPhoto {
  file: string;
  absolutePath: string;
  caption: string | undefined;
}

/**
 * Écrit les photos de démonstration dans `dir` si elles n'y sont pas déjà.
 * Idempotent : la seconde exécution ne fait que lister les fichiers.
 */
export async function ensureSamplePhotos(dir: string): Promise<GeneratedPhoto[]> {
  await fs.mkdir(dir, { recursive: true });
  const results: GeneratedPhoto[] = [];

  for (const scene of SAMPLE_SCENES) {
    const absolutePath = path.join(dir, scene.file);
    const exists = await fs
      .access(absolutePath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      const svg = Buffer.from(renderSceneSvg(scene));
      // Un léger flou puis une compression franche rapprochent le rendu
      // vectoriel des statistiques d'une vraie photographie.
      await sharp(svg, { density: 96 })
        .blur(0.4)
        .jpeg({ quality: 88, chromaSubsampling: '4:2:0' })
        .toFile(absolutePath);
    }

    results.push({ file: scene.file, absolutePath, caption: scene.caption });
  }

  return results;
}
