import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { serialiseVideo } from '@/server/serializers';
import { VideoDetail } from '@/components/video/video-detail';

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  // Ownership is enforced in the query: another user's id simply returns nothing.
  const video = await prisma.video.findFirst({
    where: { id, userId: user.id },
    include: {
      listing: { select: { title: true } },
      jobs: { orderBy: { queuedAt: 'desc' }, take: 1 },
    },
  });
  if (!video) notFound();

  return <VideoDetail initial={await serialiseVideo(video)} />;
}
