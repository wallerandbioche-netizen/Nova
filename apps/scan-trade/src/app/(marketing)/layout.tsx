import { Footer } from '@/components/layout/footer';
import { PublicNav } from '@/components/layout/public-nav';
import { getViewer } from '@/server/session';

/** Shell for every public, indexable page. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <div className="flex min-h-dvh flex-col">
      <PublicNav isAuthenticated={Boolean(viewer)} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
