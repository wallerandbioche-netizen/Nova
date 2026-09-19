import { ProjectClient } from '@/components/project/ProjectClient';
import { Logo } from '@/components/ui/Logo';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 shrink-0 items-center px-5 sm:px-8">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16 pt-4 sm:px-8">
        <ProjectClient id={id} />
      </main>
    </div>
  );
}
