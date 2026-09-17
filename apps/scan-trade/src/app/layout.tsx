import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Scan Trade — Analyse tes charts avec l'IA",
    template: '%s — Scan Trade',
  },
  description:
    'Scan Trade analyse tes captures de graphiques et t’aide à identifier les niveaux clés et scénarios potentiels.',
  applicationName: 'Scan Trade',
  keywords: ['analyse graphique', 'trading', 'chart', 'niveaux clés', 'support résistance', 'IA'],
  authors: [{ name: 'Scan Trade' }],
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Scan Trade',
    title: "Scan Trade — Analyse tes charts avec l'IA",
    description:
      'Upload une capture de ton graphique et obtiens une analyse structurée avec les niveaux clés, les scénarios potentiels et les zones de risque.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Scan Trade — Analyse tes charts avec l'IA",
    description:
      'Upload une capture de ton graphique et obtiens une analyse structurée avec les niveaux clés et les zones de risque.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#080A0F',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        {/*
          Inter is loaded at runtime rather than through `next/font`, so a build
          in an offline or proxied environment never fails on a font fetch. The
          stack falls back to the system UI font if the request does not land.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-dvh bg-background font-sans text-content">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm"
        >
          Aller au contenu principal
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
