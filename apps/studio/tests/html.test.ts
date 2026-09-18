import { describe, expect, it } from 'vitest';
import { extractImageCandidates, extractMetaContent, extractTitle, looksLikePhoto } from '@/lib/importers/html';

const BASE = new URL('https://example.com/listing/1');

describe('metadata extraction', () => {
  it('reads OpenGraph tags in either attribute order', () => {
    expect(extractMetaContent('<meta property="og:title" content="Villa">', 'og:title')).toBe('Villa');
    expect(extractMetaContent('<meta content="Villa" name="og:title">', 'og:title')).toBe('Villa');
  });

  it('falls back to the <title> tag', () => {
    expect(extractTitle('<html><title>Maison &amp; jardin</title>')).toBe('Maison & jardin');
  });

  it('puts OpenGraph images first', () => {
    const html = `
      <meta property="og:image" content="https://cdn.example.com/hero.jpg">
      <img src="/photos/salon.jpg" alt="Salon lumineux" width="1200" height="800">
    `;
    const images = extractImageCandidates(html, BASE);
    expect(images[0]?.url).toBe('https://cdn.example.com/hero.jpg');
    expect(images[1]?.url).toBe('https://example.com/photos/salon.jpg');
    expect(images[1]?.hint).toBe('Salon lumineux');
  });

  it('reads JSON-LD image arrays', () => {
    const html = `<script type="application/ld+json">
      {"@type":"LodgingBusiness","image":["https://cdn.example.com/a.jpg","https://cdn.example.com/b.jpg"]}
    </script>`;
    expect(extractImageCandidates(html, BASE).map((image) => image.url)).toEqual([
      'https://cdn.example.com/a.jpg',
      'https://cdn.example.com/b.jpg',
    ]);
  });

  it('survives malformed JSON-LD', () => {
    const html = '<script type="application/ld+json">{ not json </script><img src="/a.jpg">';
    expect(extractImageCandidates(html, BASE)).toHaveLength(1);
  });

  it('picks the widest srcset candidate', () => {
    const html = '<img srcset="/small.jpg 400w, /large.jpg 1600w, /medium.jpg 800w">';
    expect(extractImageCandidates(html, BASE)[0]?.url).toBe('https://example.com/large.jpg');
  });

  it('skips icons, logos and tiny images', () => {
    const html = `
      <img src="/logo.png"><img src="/sprite.svg"><img src="/icon-32.png">
      <img src="/thumb.jpg" width="80" height="60">
      <img src="/real-photo.jpg" width="1600" height="1200">
    `;
    expect(extractImageCandidates(html, BASE).map((image) => image.url)).toEqual([
      'https://example.com/real-photo.jpg',
    ]);
  });

  it('deduplicates the same URL across sources', () => {
    const html = `
      <meta property="og:image" content="https://example.com/a.jpg">
      <img src="https://example.com/a.jpg" alt="Salon">
    `;
    const images = extractImageCandidates(html, BASE);
    expect(images).toHaveLength(1);
    expect(images[0]?.hint).toBe('Salon');
  });

  it('rejects non-photo URLs', () => {
    expect(looksLikePhoto('https://x.com/tracking-pixel.png')).toBe(false);
    expect(looksLikePhoto('https://x.com/photo-42.jpg')).toBe(true);
  });
});
