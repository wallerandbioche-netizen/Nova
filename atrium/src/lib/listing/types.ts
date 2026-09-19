/**
 * Source d'annonce. Tout ce qui fournit des photos implémente cette interface :
 * une annonce en ligne, un dossier local, des photos importées. Le pipeline ne
 * connaît que `RawListing` — changer de source ne le fait pas bouger d'une ligne.
 */

export type ListingInput =
  | { kind: 'url'; url: string }
  | { kind: 'folder'; path: string }
  | { kind: 'upload'; uploadId: string };

export interface RawPhoto {
  /** Position d'origine dans l'annonce, avant tout réordonnancement. */
  position: number;
  /** Photo distante à télécharger. Exclusif avec `localPath`. */
  sourceUrl?: string;
  /** Photo déjà présente sur le disque. Exclusif avec `sourceUrl`. */
  localPath?: string;
  /** Légende éventuelle : indice fort sur le type d'espace. */
  caption?: string;
}

export interface RawListing {
  sourceId: string;
  sourceUrl: string | null;
  title: string | null;
  photos: RawPhoto[];
  /** Vrai si les photos sont un jeu de démonstration, pas une vraie annonce. */
  isDemo: boolean;
}

export interface FetchContext {
  projectId: string;
  signal?: AbortSignal;
}

export interface ListingSource {
  readonly id: string;
  readonly label: string;
  supports(input: ListingInput): boolean;
  fetchListing(input: ListingInput, ctx: FetchContext): Promise<RawListing>;
}
