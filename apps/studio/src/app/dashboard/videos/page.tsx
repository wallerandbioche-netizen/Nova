import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VideoCard } from '@/components/dashboard/video-card';
import { requireUser } from '@/lib/auth/session';
import { listVideos } from '@/server/videos';
import { serialiseVideo } from '@/server/serializers';

export default async function VideosPage() {
  const user = await requireUser();
  const videos = await Promise.all((await listVideos(user.id)).map(serialiseVideo));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Mes vidéos</h1>
          <p className="mt-1 text-sm text-ink-500">{videos.length} projet(s)</p>
        </div>
        <Button asChild size="sm">
          <Link href="/dashboard/new">
            <Plus />
            Nouvelle vidéo
          </Link>
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-ink-200 bg-white p-12 text-center">
          <p className="text-ink-500">Aucune vidéo pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
