import type { MetadataRoute } from 'next';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/** Public pages are indexable; everything behind the login is not (§49). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/dashboard',
        '/analyses',
        '/historique',
        '/abonnement',
        '/parametres',
        '/compte',
        '/onboarding',
        '/reinitialiser-mot-de-passe',
      ],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
