import type { MetadataRoute } from 'next';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${APP_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${APP_URL}/tarifs`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${APP_URL}/conditions`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${APP_URL}/confidentialite`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${APP_URL}/contact`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
