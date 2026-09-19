import { ButtonLink } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center px-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-5 pb-20 text-center">
        <h1 className="text-title">Cette page n’existe pas.</h1>
        <ButtonLink href="/" variant="primary" size="lg" className="mt-8">
          Retour à l’accueil
        </ButtonLink>
      </main>
    </div>
  );
}
