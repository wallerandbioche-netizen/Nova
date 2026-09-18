import { Suspense } from 'react';
import { CreateFlow } from '@/components/studio/create-flow';
import { requireUser } from '@/lib/auth/session';
import { getEnv } from '@/lib/config/env';
import { getCreditCostPerVideo } from '@/lib/config/system-config';

export default async function NewVideoPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const user = await requireUser();
  const { url } = await searchParams;
  const [costPerVideo, env] = await Promise.all([getCreditCostPerVideo(), getEnv()]);

  return (
    <Suspense>
      <CreateFlow
        initialUrl={url}
        maxUploadBytes={env.MAX_UPLOAD_BYTES}
        credits={user.creditBalance}
        costPerVideo={costPerVideo}
      />
    </Suspense>
  );
}
