import type { RemoteImageCandidate } from './types';

/**
 * Deliberately dependency-free HTML reading: we only look at public metadata that pages publish
 * for sharing (OpenGraph, JSON-LD, <img> tags). No DOM emulation, no headless browser, no
 * attempt to reach anything a normal visitor could not see.
 */

export function extractMetaContent(html: string, property: string): string | undefined {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']+)["']`,
    'i',
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escaped}["']`,
    'i',
  );
  return decodeEntities(pattern.exec(html)?.[1] ?? alt.exec(html)?.[1] ?? '') || undefined;
}

export function extractJsonLd(html: string): unknown[] {
  const results: unknown[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      results.push(JSON.parse(raw));
    } catch {
      // Malformed JSON-LD is common in the wild; skip it silently.
    }
  }
  return results;
}

export function extractTitle(html: string): string | undefined {
  const ogTitle = extractMetaContent(html, 'og:title');
  if (ogTitle) return ogTitle;
  const titleTag = decodeEntities(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1]?.trim() ?? '');
  return titleTag || undefined;
}

export function extractImageCandidates(html: string, baseUrl: URL): RemoteImageCandidate[] {
  const candidates = new Map<string, RemoteImageCandidate>();

  const add = (url: string | undefined, hint: string | undefined, priority: number) => {
    if (!url) return;
    const absolute = toAbsolute(url, baseUrl);
    if (!absolute || !looksLikePhoto(absolute)) return;
    const existing = candidates.get(absolute);
    if (existing) {
      existing.priority = Math.max(existing.priority ?? 0, priority);
      if (!existing.hint && hint) existing.hint = hint;
      return;
    }
    candidates.set(absolute, { url: absolute, hint, priority });
  };

  // 1. OpenGraph images: the listing's own hero shots.
  for (const match of html.matchAll(
    /<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/gi,
  )) {
    add(decodeEntities(match[1] ?? ''), undefined, 100);
  }

  // 2. JSON-LD `image` fields (schema.org LodgingBusiness / Product / Accommodation).
  for (const block of extractJsonLd(html)) {
    collectJsonLdImages(block, (url, hint) => add(url, hint, 80));
  }

  // 3. Plain <img> tags, largest first, with their alt text as a room hint.
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const src =
      attr(tag, 'src') ??
      firstSrcSetUrl(attr(tag, 'srcset')) ??
      attr(tag, 'data-src') ??
      attr(tag, 'data-original');
    const width = Number(attr(tag, 'width') ?? '0');
    const height = Number(attr(tag, 'height') ?? '0');
    if (width > 0 && width < 320) continue;
    if (height > 0 && height < 320) continue;
    add(src, attr(tag, 'alt') || undefined, 40);
  }

  return [...candidates.values()].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

function collectJsonLdImages(
  node: unknown,
  add: (url: string, hint: string | undefined) => void,
  depth = 0,
): void {
  if (depth > 6 || node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdImages(item, add, depth + 1);
    return;
  }
  const record = node as Record<string, unknown>;
  const name = typeof record.caption === 'string' ? record.caption : undefined;
  const image = record.image ?? record.photo ?? record.contentUrl;
  if (typeof image === 'string') add(image, name);
  else if (Array.isArray(image)) {
    for (const item of image) {
      if (typeof item === 'string') add(item, name);
      else collectJsonLdImages(item, add, depth + 1);
    }
  } else if (image && typeof image === 'object') {
    collectJsonLdImages(image, add, depth + 1);
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') collectJsonLdImages(value, add, depth + 1);
  }
}

function attr(tag: string, name: string): string | undefined {
  const pattern = new RegExp(`\\b${name}=["']([^"']*)["']`, 'i');
  const value = pattern.exec(tag)?.[1];
  return value ? decodeEntities(value) : undefined;
}

function firstSrcSetUrl(srcset: string | undefined): string | undefined {
  if (!srcset) return undefined;
  // Pick the widest descriptor so the video gets the highest resolution available.
  const entries = srcset
    .split(',')
    .map((entry) => entry.trim().split(/\s+/))
    .map(([url, descriptor]) => ({ url, width: Number((descriptor ?? '').replace(/\D/g, '')) || 0 }))
    .filter((entry): entry is { url: string; width: number } => Boolean(entry.url));
  if (entries.length === 0) return undefined;
  entries.sort((a, b) => b.width - a.width);
  return entries[0]?.url;
}

function toAbsolute(url: string, base: URL): string | undefined {
  try {
    const absolute = new URL(url, base);
    if (absolute.protocol !== 'https:' && absolute.protocol !== 'http:') return undefined;
    return absolute.toString();
  } catch {
    return undefined;
  }
}

/** Filters out sprites, icons, tracking pixels and logos by path and extension. */
export function looksLikePhoto(url: string): boolean {
  const lower = url.toLowerCase();
  if (/\.(svg|gif|ico)(\?|$)/.test(lower)) return false;
  if (/(sprite|icon|logo|favicon|avatar|pixel|badge|placeholder|tracking)/.test(lower)) return false;
  return true;
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}
