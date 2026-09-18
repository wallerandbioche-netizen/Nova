import Link from 'next/link';
import { Camera, Clapperboard, Link2, MonitorPlay, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PreviewStrip } from '@/components/marketing/preview-strip';
import { UrlForm } from '@/components/marketing/url-form';
import { getCurrentUser } from '@/lib/auth/session';
import { STYLE_LIST } from '@/lib/video/styles';
import { FORMAT_LIST } from '@/lib/video/formats';

export default async function LandingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-ink-50">
            <Clapperboard className="h-4 w-4" />
          </span>
          Nova Studio
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link href="/dashboard">Mon espace</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Se connecter</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Créer une vidéo</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 sm:pt-20">
          <div className="animate-rise mx-auto max-w-4xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs text-ink-500">
              <Sparkles className="h-3.5 w-3.5 text-accent-600" />
              Montage automatique à partir des photos de votre annonce
            </p>
            <h1 className="text-balance text-[2.1rem] font-semibold leading-[1.1] tracking-tight text-ink-950 sm:text-5xl lg:text-[3.5rem]">
              Transformez vos photos immobilières en vidéos professionnelles.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-ink-500">
              Collez le lien de votre annonce et créez automatiquement un montage vidéo cinématique
              à partir des photos de votre bien.
            </p>
          </div>

          <div className="animate-rise mx-auto mt-10 max-w-2xl" style={{ animationDelay: '80ms' }}>
            <UrlForm signedIn={Boolean(user)} />
            <p className="mt-3 text-center text-xs text-ink-400">
              Pas de lien compatible ? Importez vos photos manuellement, le résultat est le même —
              ou essayez avec notre jeu de photos d’exemple depuis votre espace.
            </p>
          </div>

          <div className="animate-rise mt-20" style={{ animationDelay: '160ms' }}>
            <PreviewStrip />
          </div>
        </section>

        <section className="border-y border-ink-200 bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 sm:grid-cols-3">
            {[
              {
                icon: Link2,
                title: 'Collez un lien',
                body: 'Nous récupérons les photos publiques de l’annonce, ou vous les importez vous-même.',
              },
              {
                icon: Wand2,
                title: 'Nous montons',
                body: 'Les photos sont analysées, triées, recadrées et animées comme le ferait un vidéaste.',
              },
              {
                icon: MonitorPlay,
                title: 'Vous téléchargez',
                body: 'Un MP4 prêt à publier en 9:16, 16:9 ou 1:1. Aucune musique, aucun texte, aucun logo.',
              },
            ].map((step, index) => (
              <div key={step.title}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-100 text-ink-700">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-medium tabular-nums text-ink-400">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-lg font-medium text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-950">
            Quatre styles, trois formats
          </h2>
          <p className="mt-2 max-w-2xl text-ink-500">
            Le style change le rythme, la durée des plans, les mouvements et les transitions. Jamais
            le contenu : la vidéo ne montre que vos photos.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STYLE_LIST.map((style) => (
              <div
                key={style.id}
                className="rounded-[var(--radius-card)] border border-ink-200 bg-white p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-accent-600" />
                  <h3 className="font-medium text-ink-900">{style.label}</h3>
                </div>
                <p className="text-sm leading-relaxed text-ink-500">{style.description}</p>
                <p className="mt-4 text-xs tabular-nums text-ink-400">
                  ~{style.baseShotSeconds.toFixed(1)} s par plan
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {FORMAT_LIST.map((format) => (
              <div
                key={format.id}
                className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-ink-800">{format.label}</span>
                <span className="text-xs text-ink-400">{format.usage}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-ink-200 bg-white">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-ink-950">
              Votre première vidéo en quelques minutes.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-500">
              Trois crédits offerts à l’inscription. Aucune carte bancaire requise pour commencer.
            </p>
            <Button asChild variant="accent" size="lg" className="mt-8">
              <Link href={user ? '/dashboard' : '/signup'}>Créer une vidéo</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-10 text-sm text-ink-400">
        <div className="flex flex-col justify-between gap-4 border-t border-ink-200 pt-8 sm:flex-row">
          <p>© {new Date().getFullYear()} Nova Studio</p>
          <p>
            Les photos importées restent privées et vous appartiennent. Aucune image n’est générée
            artificiellement.
          </p>
        </div>
      </footer>
    </div>
  );
}
