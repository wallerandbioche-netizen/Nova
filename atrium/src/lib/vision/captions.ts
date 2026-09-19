import type { RoomType } from '@/types/domain';

/**
 * Lecture des légendes d'annonce. Quand une photo est légendée, c'est le
 * signal de classement le plus fiable et le moins coûteux qui soit.
 */
const KEYWORDS: Array<[RoomType, RegExp]> = [
  ['living_room', /salon|séjour|sejour|living|lounge|salle de séjour|pièce de vie|piece de vie/i],
  ['kitchen', /cuisine|kitchen|kitchenette|coin repas|îlot|ilot/i],
  ['dining_room', /salle à manger|salle a manger|dining/i],
  ['bedroom', /chambre|bedroom|couchage|lit double|master/i],
  ['bathroom', /salle de bain|salle d'eau|bathroom|douche|baignoire|shower|wc|toilette/i],
  ['office', /bureau|office|espace de travail|workspace/i],
  ['hallway', /entrée|entree|couloir|hall|palier/i],
  ['pool', /piscine|pool|bassin|jacuzzi|spa/i],
  ['terrace', /terrasse|terrace|balcon|balcony|patio|véranda|veranda|rooftop/i],
  ['garden', /jardin|garden|pelouse|verger|potager/i],
  ['view', /vue|view|panorama|paysage|horizon|coucher de soleil|sunset/i],
  ['exterior', /façade|facade|extérieur|exterieur|exterior|villa|maison vue|cour|allée|allee/i],
  ['detail', /détail|detail|décoration|decoration|close-?up/i],
];

export function roomFromCaption(caption: string | undefined | null): RoomType | null {
  if (!caption) return null;
  for (const [room, pattern] of KEYWORDS) {
    if (pattern.test(caption)) return room;
  }
  return null;
}
