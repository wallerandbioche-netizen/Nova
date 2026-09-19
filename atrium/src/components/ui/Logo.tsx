import Link from 'next/link';

/**
 * Marque : un carré dont l'intérieur est décalé, comme un cadrage qui glisse.
 * C'est exactement ce que fait le produit.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2.5 transition-opacity duration-quick hover:opacity-70"
      aria-label="Atrium, accueil"
    >
      <span className="relative block h-5 w-5" aria-hidden="true">
        <span className="absolute inset-0 rounded-[6px] border border-ink/25" />
        <span
          className="absolute left-[5px] top-[3px] h-[10px] w-[7px] rounded-[2px] bg-ink
                     transition-transform duration-calm ease-out-soft group-hover:translate-x-[3px]"
        />
      </span>
      {!compact && (
        <span className="text-[0.9375rem] font-medium tracking-[-0.02em]">Atrium</span>
      )}
    </Link>
  );
}
