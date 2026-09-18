import type { AspectRatio } from '@prisma/client';

export interface FormatSpec {
  id: AspectRatio;
  label: string;
  width: number;
  height: number;
  ratio: number;
  usage: string;
}

export const FORMATS: Record<AspectRatio, FormatSpec> = {
  VERTICAL: {
    id: 'VERTICAL',
    label: '9:16 — Vertical',
    width: 1080,
    height: 1920,
    ratio: 1080 / 1920,
    usage: 'Instagram Reels, TikTok, YouTube Shorts',
  },
  HORIZONTAL: {
    id: 'HORIZONTAL',
    label: '16:9 — Horizontal',
    width: 1920,
    height: 1080,
    ratio: 1920 / 1080,
    usage: 'YouTube, site web, présentation',
  },
  SQUARE: {
    id: 'SQUARE',
    label: '1:1 — Carré',
    width: 1080,
    height: 1080,
    ratio: 1,
    usage: 'Fil Instagram, Facebook, LinkedIn',
  },
};

export const FORMAT_LIST = Object.values(FORMATS);

export function getFormat(aspectRatio: AspectRatio): FormatSpec {
  return FORMATS[aspectRatio];
}
