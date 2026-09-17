import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { isGoogleOAuthConfigured } from '@/lib/env';
import { LoginForm } from '@/features/auth/login-form';
import { getViewer } from '@/server/session';

export const metadata: Metadata = { title: 'Connexion', robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await getViewer()) redirect('/dashboard');

  return (
    <Suspense fallback={null}>
      <LoginForm googleEnabled={isGoogleOAuthConfigured()} />
    </Suspense>
  );
}
