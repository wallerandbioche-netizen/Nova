import { ButtonLink } from '@/components/ui/Button';
import type { ProjectError } from '@/types/domain';

export function ErrorPanel({ error }: { error: ProjectError | null }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span
        className="grid h-11 w-11 place-items-center rounded-full border border-line"
        aria-hidden="true"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-muted">
          <path
            d="M7.5 4v4.2M7.5 10.8v.2"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <h1 className="mt-7 text-title text-balance">
        {error?.message ?? 'Une erreur est survenue. Veuillez réessayer.'}
      </h1>

      <div className="mt-9 flex items-center gap-3">
        <ButtonLink href="/" variant="primary" size="lg">
          Réessayer
        </ButtonLink>
      </div>
    </div>
  );
}
