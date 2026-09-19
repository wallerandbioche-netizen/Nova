import { describe, expect, it } from 'vitest';
import { extractPhotoUrls } from './airbnb';

describe('extractPhotoUrls', () => {
  it('collecte les photos d\'annonce dans leur ordre d\'apparition', () => {
    const html = `
      <img src="https://a0.muscache.com/im/pictures/aaa/photo.jpg?im_w=720">
      <script>{"baseUrl":"https:\\u002F\\u002Fa0.muscache.com\\u002Fim\\u002Fpictures\\u002Fbbb\\u002Fphoto.jpg"}</script>
      <img src="https://a0.muscache.com/im/pictures/aaa/photo.jpg?im_w=1440">
      <img src="https://a0.muscache.com/im/pictures/user/avatar.jpg">
      <img src="https://example.com/other.jpg">
    `;
    expect(extractPhotoUrls(html)).toEqual([
      'https://a0.muscache.com/im/pictures/aaa/photo.jpg?im_w=1440',
      'https://a0.muscache.com/im/pictures/bbb/photo.jpg?im_w=1440',
    ]);
  });

  it('respecte la limite demandée', () => {
    const html = Array.from(
      { length: 10 },
      (_, i) => `<img src="https://a0.muscache.com/im/pictures/p${i}/x.jpg">`,
    ).join('');
    expect(extractPhotoUrls(html, 4)).toHaveLength(4);
  });
});
