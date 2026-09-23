import type { Metadata } from 'next';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

export const metadata: Metadata = {
  title: 'Bienvenue',
  description: 'Quelques questions pour régler SCAN TRADE sur votre façon de travailler.',
};

export default function WelcomePage() {
  return <OnboardingFlow />;
}
