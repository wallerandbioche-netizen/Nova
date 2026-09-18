import type { RoomType } from '@prisma/client';

/**
 * Room detection from the caption/alt text a listing publishes with each photo.
 *
 * This is deliberately conservative: an unrecognised caption stays OTHER rather than being
 * guessed at. The product must never claim a property has a pool because a word looked close.
 */
const KEYWORDS: { room: RoomType; patterns: RegExp }[] = [
  { room: 'POOL', patterns: /\b(piscine|pool|jacuzzi|swimming|bassin)\b/i },
  { room: 'TERRACE', patterns: /\b(terrasse|terrace|balcon|balcony|patio|deck|veranda|véranda)\b/i },
  { room: 'GARDEN', patterns: /\b(jardin|garden|pelouse|lawn|cour|courtyard|yard)\b/i },
  { room: 'VIEW', patterns: /\b(vue|view|panorama|paysage|landscape|horizon|coucher de soleil|sunset)\b/i },
  { room: 'KITCHEN', patterns: /\b(cuisine|kitchen|kitchenette|cuisson)\b/i },
  { room: 'DINING', patterns: /\b(salle à manger|salle a manger|dining|repas|table à manger)\b/i },
  { room: 'BATHROOM', patterns: /\b(salle de bain|salle d'eau|bathroom|shower|douche|baignoire|bathtub|wc|toilet)\b/i },
  { room: 'BEDROOM', patterns: /\b(chambre|bedroom|lit\b|bed\b|suite|couchage|dortoir)\b/i },
  { room: 'LIVING_ROOM', patterns: /\b(salon|séjour|sejour|living|lounge|canapé|canape|sofa|pièce de vie)\b/i },
  { room: 'EXTERIOR', patterns: /\b(extérieur|exterieur|exterior|façade|facade|outside|entrée|entree|maison vue|villa|building|rue)\b/i },
];

export function detectRoomFromHint(hint: string | undefined | null): {
  room: RoomType;
  confidence: number;
} {
  if (!hint) return { room: 'OTHER', confidence: 0 };
  const text = hint.normalize('NFC');
  for (const { room, patterns } of KEYWORDS) {
    if (patterns.test(text)) return { room, confidence: 0.75 };
  }
  return { room: 'OTHER', confidence: 0 };
}

/** Rooms shown outdoors; the ordering algorithm bookends the video with them. */
export const OUTDOOR_ROOMS: RoomType[] = ['EXTERIOR', 'TERRACE', 'POOL', 'GARDEN', 'VIEW'];

export function isOutdoor(room: RoomType): boolean {
  return OUTDOOR_ROOMS.includes(room);
}

export const ROOM_LABELS: Record<RoomType, string> = {
  EXTERIOR: 'Extérieur',
  LIVING_ROOM: 'Salon',
  KITCHEN: 'Cuisine',
  DINING: 'Salle à manger',
  BEDROOM: 'Chambre',
  BATHROOM: 'Salle de bain',
  TERRACE: 'Terrasse',
  POOL: 'Piscine',
  GARDEN: 'Jardin',
  VIEW: 'Vue',
  OTHER: 'Autre',
};
