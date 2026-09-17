import type { ReactNode } from 'react';
import { Disclaimer } from '@/components/layout/disclaimer';

/** Shared frame for the legal and contact pages: one column, generous measure. */
export function LegalPage({
  title,
  updatedAt,
  children,
}: {
  title: string;
  updatedAt: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <h1 className="text-display font-semibold text-content">{title}</h1>
      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-content-faint">Mise à jour : {updatedAt}</p>
      <div className="mt-10 space-y-8">{children}</div>
      <Disclaimer className="mt-12" />
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-content">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-content-muted">{children}</p>
    </section>
  );
}
