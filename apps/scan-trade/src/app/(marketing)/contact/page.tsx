import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { LegalPage } from '@/components/marketing/legal';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contacter l’équipe Scan Trade : support, facturation, confidentialité.',
  alternates: { canonical: '/contact' },
};

const CHANNELS = [
  {
    label: 'Support produit',
    email: 'support@scan-trade.app',
    detail: 'Bug, analyse inattendue, question d’usage.',
  },
  {
    label: 'Facturation',
    email: 'billing@scan-trade.app',
    detail: 'Abonnement, facture, résiliation.',
  },
  {
    label: 'Confidentialité',
    email: 'privacy@scan-trade.app',
    detail: 'Accès, rectification ou suppression de données.',
  },
] as const;

export default function ContactPage() {
  return (
    <LegalPage title="Contact" updatedAt="16 septembre 2026">
      <p className="text-sm leading-relaxed text-content-muted">
        Écris-nous à l&apos;adresse correspondant à ta demande. Nous répondons sous deux jours
        ouvrés.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {CHANNELS.map((channel) => (
          <Card key={channel.email} className="p-5">
            <p className="text-sm font-medium text-content">{channel.label}</p>
            <a
              href={`mailto:${channel.email}`}
              className="mt-1 inline-block text-sm text-accent underline-offset-4 hover:underline"
            >
              {channel.email}
            </a>
            <p className="mt-2 text-sm text-content-muted">{channel.detail}</p>
          </Card>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-content-faint">
        Ces adresses sont des exemples de contact pour ce déploiement : remplace-les par les
        adresses réelles de ton organisation avant la mise en production.
      </p>
    </LegalPage>
  );
}
