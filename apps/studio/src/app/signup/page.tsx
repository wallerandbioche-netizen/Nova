import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clapperboard } from 'lucide-react';
import { AuthForm } from '@/components/auth/auth-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth/session';

export default async function SignupPage() {
  if (await getCurrentUser()) redirect('/dashboard');

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 self-center font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-ink-50">
          <Clapperboard className="h-4 w-4" />
        </span>
        Nova Studio
      </Link>
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle>Créer un compte</CardTitle>
          <CardDescription>Trois crédits offerts pour vos premières vidéos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <AuthForm mode="signup" />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
