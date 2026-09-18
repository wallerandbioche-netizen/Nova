import Link from 'next/link';
import { ArrowRight, Coins, Plus, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VideoCard } from '@/components/dashboard/video-card';
import { requireUser } from '@/lib/auth/session';
import { listVideos } from '@/server/videos';
import { serialiseVideo } from '@/server/serializers';
import { getCreditCostPerVideo } from '@/lib/config/system-config';

export default async function DashboardPage() {
  const user = await requireUser();
  const [videos, costPerVideo] = await Promise.all([
    listVideos(user.id, 6),
    getCreditCostPerVideo(),
  ]);
  const serialised = await Promise.all(videos.map(serialiseVideo));
  const inProgress = serialised.filter((video) =>
    ['QUEUED', 'PROCESSING', 'RENDERING', 'UPLOADING'].includes(video.status),
  );

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-950">
          Bonjour{user.name ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-ink-500">Créez une nouvelle vidéo à partir d’une annonce.</p>

        <Card className="mt-6 border-ink-300 bg-white">
          <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-medium text-ink-900">Créer une nouvelle vidéo</h2>
              <p className="mt-1 text-sm text-ink-500">
                Collez le lien de votre annonce, ou importez vos photos.
              </p>
            </div>
            <Button asChild size="lg" variant="accent">
              <Link href="/dashboard/new">
                <Plus />
                Nouvelle vidéo
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-ink-400">
              <Coins className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Crédits</span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-ink-900">
              {user.creditBalance}
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {costPerVideo} crédit{costPerVideo > 1 ? 's' : ''} par vidéo générée
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-ink-400">
              <Video className="h-4 w-4" />
              <span className="text-xs uppercase tracking-wide">Vidéos</span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-ink-900">
              {serialised.length}
            </p>
            <p className="mt-1 text-xs text-ink-400">créées récemment</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-ink-400">
              <span className="text-xs uppercase tracking-wide">En cours</span>
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-ink-900">
              {inProgress.length}
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {inProgress.length > 0 ? 'génération en cours' : 'aucune génération en cours'}
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink-900">Vidéos récentes</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/videos">
              Tout voir
              <ArrowRight />
            </Link>
          </Button>
        </div>

        {serialised.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-dashed border-ink-200 bg-white p-12 text-center">
            <p className="text-ink-500">Vous n’avez pas encore de vidéo.</p>
            <Button asChild className="mt-4" size="sm">
              <Link href="/dashboard/new">Créer ma première vidéo</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {serialised.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
