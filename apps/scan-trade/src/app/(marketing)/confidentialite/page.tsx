import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/marketing/legal';

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description: 'Comment Scan Trade traite, stocke et supprime les données de ses utilisateurs.',
  alternates: { canonical: '/confidentialite' },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité" updatedAt="16 septembre 2026">
      <LegalSection title="Données collectées">
        Adresse e-mail, nom si renseigné, date d&apos;inscription, préférences de marché et de style
        de trading déclarées à l&apos;inscription, captures d&apos;écran importées et analyses
        produites, état de l&apos;abonnement transmis par Stripe.
      </LegalSection>

      <LegalSection title="Ce que nous ne collectons pas">
        Aucune donnée bancaire : le paiement est traité intégralement par Stripe, qui seul manipule
        les numéros de carte. Aucun accès à un compte de courtage. Aucun suivi publicitaire tiers.
      </LegalSection>

      <LegalSection title="Captures d'écran">
        Les images sont stockées dans un espace privé, sous un nom généré aléatoirement, et ne sont
        jamais servies publiquement. Elles ne sont accessibles qu&apos;au compte qui les a
        importées, via des liens temporaires. Un autre utilisateur ne peut, en aucun cas, accéder à
        tes analyses ni à tes images.
      </LegalSection>

      <LegalSection title="Entraînement de modèles">
        Les captures et les analyses ne sont pas utilisées pour entraîner un modèle. Elles sont
        transmises au fournisseur d&apos;analyse pour le seul traitement de ta demande.
      </LegalSection>

      <LegalSection title="Conservation et suppression">
        Une analyse supprimée l&apos;est immédiatement en base, et sa capture est effacée du
        stockage. La suppression du compte efface l&apos;ensemble des analyses, des captures et des
        données de profil, et résilie l&apos;abonnement en cours. Les enregistrements strictement
        nécessaires à nos obligations comptables sont conservés par Stripe selon ses propres durées
        légales.
      </LegalSection>

      <LegalSection title="Journalisation">
        Les journaux techniques enregistrent les erreurs, la durée des analyses et les appels aux
        services externes. Ils ne contiennent ni mot de passe, ni jeton, ni clé d&apos;API, ni
        donnée bancaire.
      </LegalSection>

      <LegalSection title="Tes droits">
        Tu peux consulter, corriger ou supprimer tes données depuis les paramètres du compte. Pour
        toute demande complémentaire, écris-nous depuis la page Contact.
      </LegalSection>
    </LegalPage>
  );
}
