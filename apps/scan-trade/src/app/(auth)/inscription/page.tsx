import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { RegisterForm } from '@/features/auth/register-form';
import { getViewer } from '@/server/session';

export const metadata: Metadata = {
  title: 'Créer un compte',
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  if (await getViewer()) redirect('/dashboard');
  return <RegisterForm />;
}
