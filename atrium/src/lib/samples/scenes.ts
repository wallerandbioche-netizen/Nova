import type { RoomType } from '@/types/domain';

export interface Palette {
  sky: string;
  skyLow: string;
  wall: string;
  wallLow: string;
  floor: string;
  floorLow: string;
  accent: string;
  warm: string;
  deep: string;
}

export interface SampleScene {
  file: string;
  room: RoomType;
  caption?: string;
  width: number;
  height: number;
  kind: 'interior' | 'outdoor' | 'water';
  palette: Palette;
  /** Sujet principal, en coordonnées normalisées : guide le décor. */
  subject: { x: number; y: number };
  /** Décalage appliqué aux variantes quasi identiques (test de déduplication). */
  drift?: number;
}

const stone: Palette = {
  sky: '#dfe6ec',
  skyLow: '#c3ced8',
  wall: '#f2efea',
  wallLow: '#ddd7cd',
  floor: '#b9a894',
  floorLow: '#8d7c69',
  accent: '#3f4a54',
  warm: '#e8c9a0',
  deep: '#2a2f36',
};

const linen: Palette = {
  sky: '#e9e4dc',
  skyLow: '#cfc7ba',
  wall: '#f7f4ef',
  wallLow: '#e4ded3',
  floor: '#c9b9a4',
  floorLow: '#9b8a74',
  accent: '#6d6257',
  warm: '#f0d9b5',
  deep: '#3a342d',
};

const slate: Palette = {
  sky: '#dbe3e8',
  skyLow: '#bdc8d1',
  wall: '#eceff1',
  wallLow: '#d3d9dd',
  floor: '#a9b0b5',
  floorLow: '#7c8489',
  accent: '#37474f',
  warm: '#e5d3b8',
  deep: '#22292e',
};

const garden: Palette = {
  sky: '#cfe0ea',
  skyLow: '#a9c6d8',
  wall: '#e6ead9',
  wallLow: '#c3cdb0',
  floor: '#7c9155',
  floorLow: '#4f6435',
  accent: '#35502c',
  warm: '#e9d6a8',
  deep: '#22331c',
};

const water: Palette = {
  sky: '#c8dfec',
  skyLow: '#9fc6dc',
  wall: '#eef2f3',
  wallLow: '#cdd8db',
  floor: '#3fa3c4',
  floorLow: '#1d6f95',
  accent: '#0f4c63',
  warm: '#f2e0bd',
  deep: '#0b3546',
};

const LANDSCAPE = { width: 1600, height: 1067 };
const PORTRAIT = { width: 1067, height: 1600 };
const SQUARE = { width: 1200, height: 1200 };
const WIDE = { width: 1920, height: 820 };

/**
 * Annonce de démonstration : quinze photos, formats mélangés, deux paires
 * quasi identiques pour éprouver la déduplication, et une photo volontairement
 * sombre pour éprouver le scoring.
 */
export const SAMPLE_SCENES: SampleScene[] = [
  {
    file: 'photo_01.jpg',
    room: 'exterior',
    caption: 'Façade de la villa',
    ...LANDSCAPE,
    kind: 'outdoor',
    palette: stone,
    subject: { x: 0.44, y: 0.55 },
  },
  {
    file: 'photo_02.jpg',
    room: 'living_room',
    caption: 'Salon avec cheminée',
    ...LANDSCAPE,
    kind: 'interior',
    palette: linen,
    subject: { x: 0.63, y: 0.52 },
  },
  {
    file: 'photo_03.jpg',
    room: 'living_room',
    caption: 'Salon avec cheminée',
    ...LANDSCAPE,
    kind: 'interior',
    palette: linen,
    subject: { x: 0.63, y: 0.52 },
    drift: 0.012,
  },
  {
    file: 'photo_04.jpg',
    room: 'living_room',
    caption: 'Coin lecture',
    ...PORTRAIT,
    kind: 'interior',
    palette: linen,
    subject: { x: 0.38, y: 0.58 },
  },
  {
    file: 'photo_05.jpg',
    room: 'kitchen',
    caption: 'Cuisine ouverte',
    ...LANDSCAPE,
    kind: 'interior',
    palette: slate,
    subject: { x: 0.52, y: 0.6 },
  },
  {
    file: 'photo_06.jpg',
    room: 'kitchen',
    ...SQUARE,
    kind: 'interior',
    palette: slate,
    subject: { x: 0.35, y: 0.55 },
  },
  {
    file: 'photo_07.jpg',
    room: 'bedroom',
    caption: 'Chambre principale',
    ...LANDSCAPE,
    kind: 'interior',
    palette: linen,
    subject: { x: 0.46, y: 0.6 },
  },
  {
    file: 'photo_08.jpg',
    room: 'bedroom',
    caption: 'Chambre principale',
    ...LANDSCAPE,
    kind: 'interior',
    palette: linen,
    subject: { x: 0.46, y: 0.6 },
    drift: 0.009,
  },
  {
    file: 'photo_09.jpg',
    room: 'bedroom',
    caption: 'Seconde chambre',
    ...PORTRAIT,
    kind: 'interior',
    palette: stone,
    subject: { x: 0.55, y: 0.62 },
  },
  {
    file: 'photo_10.jpg',
    room: 'bathroom',
    caption: 'Salle de bain en pierre',
    ...PORTRAIT,
    kind: 'interior',
    palette: slate,
    subject: { x: 0.6, y: 0.5 },
  },
  {
    file: 'photo_11.jpg',
    room: 'terrace',
    caption: 'Terrasse ombragée',
    ...WIDE,
    kind: 'outdoor',
    palette: stone,
    subject: { x: 0.7, y: 0.58 },
  },
  {
    file: 'photo_12.jpg',
    room: 'pool',
    caption: 'Piscine à débordement',
    ...LANDSCAPE,
    kind: 'water',
    palette: water,
    subject: { x: 0.5, y: 0.62 },
  },
  {
    file: 'photo_13.jpg',
    room: 'garden',
    caption: 'Jardin méditerranéen',
    ...LANDSCAPE,
    kind: 'outdoor',
    palette: garden,
    subject: { x: 0.4, y: 0.64 },
  },
  {
    file: 'photo_14.jpg',
    room: 'view',
    caption: 'Vue sur la vallée',
    ...WIDE,
    kind: 'outdoor',
    palette: water,
    subject: { x: 0.55, y: 0.46 },
  },
  {
    file: 'photo_15.jpg',
    room: 'detail',
    ...SQUARE,
    kind: 'interior',
    palette: stone,
    subject: { x: 0.5, y: 0.5 },
  },
];
