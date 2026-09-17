import type { Metadata } from 'next';
import { getCoreEnv } from '@/lib/env';
import { NewAnalysis } from '@/features/analysis/new-analysis';
import { Disclaimer } from '@/components/layout/disclaimer';
import { requireViewer } from '@/server/session';

export const metadata: Metadata = { title: 'Nouvelle analyse' };
export const dynamic = 'force-dynamic';

export default async function NewAnalysisPage() {
  const viewer = await requireViewer();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-display font-semibold text-content">Nouvelle analyse</h1>
        <p className="mt-2 text-sm text-content-muted">
          Importe la capture de ton graphique. Les champs d&apos;aide sont optionnels.
        </p>
      </div>

      <NewAnalysis maxUploadBytes={getCoreEnv().MAX_UPLOAD_BYTES} isSubscribed={viewer.isSubscribed} />

      <Disclaimer />
    </div>
  );
}
