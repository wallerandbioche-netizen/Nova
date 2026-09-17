import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function AnalysisNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl py-10">
      <EmptyState
        title="Cette analyse n'existe pas ou a été supprimée."
        description="Elle a peut-être été effacée, ou le lien est obsolète."
        action={<ButtonLink href="/historique">Retour à l&apos;historique</ButtonLink>}
      />
    </div>
  );
}
