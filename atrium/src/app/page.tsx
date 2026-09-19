import { CreateForm } from '@/components/landing/CreateForm';
import { Header } from '@/components/landing/Header';
import { Showcase } from '@/components/landing/Showcase';
import { Reveal } from '@/components/ui/Reveal';
import Link from 'next/link';

const STEPS = [
  ['Un lien', 'Vous collez l’adresse de votre annonce.'],
  ['Une lecture', 'Les espaces, les meilleures vues et l’ordre sont déduits des photos.'],
  ['Une vidéo', 'Mouvements de caméra, transitions, montage. Rien à régler.'],
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="flex-1">
        <section className="mx-auto flex max-w-6xl flex-col items-center px-5 pb-20 pt-20 text-center sm:px-8 sm:pb-28 sm:pt-32">
          <Reveal>
            <h1 className="text-display text-balance">
              Votre espace,
              <br />
              en mouvement.
            </h1>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="mx-auto mt-7 max-w-lg text-lead text-balance text-muted">
              Transformez les photos de votre logement en une vidéo cinématique en quelques
              secondes.
            </p>
          </Reveal>

          <Reveal delay={0.16} className="mt-11 flex w-full justify-center">
            <CreateForm />
          </Reveal>
        </section>

        <section className="px-5 pb-24 sm:px-8 sm:pb-32">
          <Reveal delay={0.24}>
            <Showcase />
          </Reveal>
        </section>

        <section className="border-t border-line/70">
          <div className="mx-auto grid max-w-5xl gap-10 px-5 py-20 sm:grid-cols-3 sm:gap-8 sm:px-8 sm:py-24">
            {STEPS.map(([title, description], index) => (
              <div key={title}>
                <p className="text-caption tabular-nums text-faint">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h2 className="mt-3 text-heading">{title}</h2>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-caption text-faint sm:flex-row sm:px-8">
          <p>Atrium</p>
          <Link
            href="/comment-ca-marche"
            className="transition-colors duration-quick hover:text-ink"
          >
            Comment ça marche
          </Link>
        </div>
      </footer>
    </div>
  );
}
