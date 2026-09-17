import { cn } from '@/utils/cn';

export const DISCLAIMER_TEXT =
  'Scan Trade fournit des informations et analyses à caractère éducatif et informatif. ' +
  'Les scénarios, niveaux et analyses générés ne constituent pas des conseils financiers personnalisés ' +
  'ni une garantie de résultat. Le trading comporte des risques importants de perte en capital. ' +
  "L'utilisateur reste seul responsable de ses décisions.";

/**
 * The financial disclaimer (§21).
 *
 * Shown on the landing page, on every analysis, and in the footer. It is a
 * component rather than copied text so the wording can never drift apart.
 */
export function Disclaimer({
  variant = 'block',
  className,
}: {
  variant?: 'block' | 'compact';
  className?: string;
}) {
  if (variant === 'compact') {
    return (
      <p className={cn('text-xs leading-relaxed text-content-faint', className)}>
        {DISCLAIMER_TEXT}
      </p>
    );
  }

  return (
    <aside
      className={cn(
        'rounded-xl border border-border bg-surface/60 px-4 py-3.5 text-xs leading-relaxed text-content-muted',
        className,
      )}
    >
      <p className="mb-1 font-medium uppercase tracking-[0.14em] text-content-faint">
        Avertissement
      </p>
      {DISCLAIMER_TEXT}
    </aside>
  );
}
