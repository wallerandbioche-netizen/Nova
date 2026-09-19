import Link from 'next/link';
import { Header } from '@/components/landing/Header';
import { Reveal } from '@/components/ui/Reveal';

export const metadata = {
  title: 'Comment ça marche — Atrium',
};

const STEPS: Array<[string, string]> = [
  [
    'Les photos sont récupérées',
    'À partir du lien de votre annonce, ou directement depuis vos fichiers. Chaque photo est réorientée et ramenée à une définition de travail commune.',
  ],
  [
    'Chaque photo est lue',
    'Type d’espace, netteté, exposition, composition, sujet principal. Les photos qui montrent deux fois le même angle sont regroupées, et seule la meilleure est retenue.',
  ],
  [
    'Un ordre est construit',
    'Une vue d’ensemble ouvre la séquence, puis les pièces de vie, les chambres, les espaces d’eau, le dehors. Les chapitres absents sont simplement sautés.',
  ],
  [
    'La caméra est placée',
    'Pour chaque photo, un cadre de départ et un cadre d’arrivée, calculés autour du sujet. Le mouvement ne coupe jamais ce qui compte, et ne se répète pas d’un plan à l’autre.',
  ],
  [
    'La vidéo est montée',
    'Durées variables selon la qualité de chaque photo, fondus enchaînés, ouverture et fermeture au noir. Puis un fichier MP4.',
  ],
];

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <h1 className="text-title text-balance">Comment ça marche</h1>
          <p className="mt-5 text-lead text-muted">
            Vous donnez un lien. Le reste se décide tout seul.
          </p>
        </Reveal>

        <ol className="mt-16 flex flex-col gap-12">
          {STEPS.map(([title, description], index) => (
            <Reveal key={title} delay={0.05 * index}>
              <li className="grid grid-cols-[2rem_1fr] gap-4 sm:grid-cols-[3rem_1fr]">
                <span className="pt-1 text-caption tabular-nums text-faint">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 className="text-heading">{title}</h2>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{description}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.3}>
          <section className="mt-20 border-t border-line pt-10">
            <h2 className="text-heading">Ce que la vidéo ne contient pas</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
              Ni musique, ni voix, ni texte, ni logo, ni sous-titre, ni élément graphique. Seulement
              vos photographies, des mouvements de caméra et des fondus.
            </p>
          </section>
        </Reveal>

        <Reveal delay={0.34}>
          <section id="compte" className="mt-12 border-t border-line pt-10">
            <h2 className="text-heading">Et les annonces en ligne ?</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">
              La source des photos est interchangeable. Lorsque la récupération directe d’une
              annonce n’est pas possible, l’import de vos propres photos donne exactement le même
              résultat. Aucune protection d’un site tiers n’est contournée.
            </p>
            <p className="mt-6 text-[0.9375rem] text-muted">
              Aucun compte n’est nécessaire pour créer une vidéo.
            </p>
          </section>
        </Reveal>

        <Reveal delay={0.38}>
          <p className="mt-16">
            <Link
              href="/"
              className="text-[0.9375rem] text-ink underline decoration-line-strong underline-offset-4
                         transition-colors duration-quick hover:decoration-ink/40"
            >
              Créer une vidéo
            </Link>
          </p>
        </Reveal>
      </main>
    </div>
  );
}
