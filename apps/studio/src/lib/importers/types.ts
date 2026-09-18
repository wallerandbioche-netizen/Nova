import type { ImportSource } from '@prisma/client';

export interface RemoteImageCandidate {
  url: string;
  /** Alt text or caption from the page: the only honest room hint we get without a vision model. */
  hint?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  /** Higher is better; importers use it to keep hero images first. */
  priority?: number;
}

export interface ImportResult {
  platform: ImportSource;
  title?: string | undefined;
  location?: string | undefined;
  images: RemoteImageCandidate[];
  /** Explains a partial or empty result in the user's language. */
  notice?: string | undefined;
}

/**
 * A ListingImporter turns a public URL into image candidates.
 *
 * Rules every implementation follows:
 *   1. official/public data only — no CAPTCHA solving, no login, no anti-bot evasion;
 *   2. robots.txt is honoured;
 *   3. failure is a normal outcome: return an empty result with a notice, and the product
 *      falls back to manual upload instead of pretending.
 */
export interface ListingImporter {
  readonly platform: ImportSource;
  readonly label: string;
  supports(url: URL): boolean;
  import(url: URL): Promise<ImportResult>;
}
