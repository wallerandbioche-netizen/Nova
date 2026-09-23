import type { Metadata } from 'next';
import { AuthView } from '@/components/account/auth-view';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous ou créez votre compte SCAN TRADE par lien e-mail.',
};

export default function SignInPage() {
  return <AuthView />;
}
