import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '@/components/marketing/legal';
import { DISCLAIMER_TEXT } from '@/components/layout/disclaimer';

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Conditions d'utilisation du service Scan Trade.",
  alternates: { canonical: '/conditions' },
};

export default function TermsPage() {
  return (
    <LegalPage title="Conditions d'utilisation" updatedAt="16 septembre 2026">
      <LegalSection title="1. Objet du service">
        Scan Trade est un outil d&apos;aide à la lecture de graphiques. L&apos;utilisateur importe une capture
        d&apos;écran ; le service en restitue une analyse structurée : tendance apparente, structure, niveaux
        identifiés et, lorsque cela se justifie, un scénario potentiel assorti de ses conditions d&apos;invalidation.
      </LegalSection>

      <LegalSection title="2. Absence de conseil en investissement">
        {DISCLAIMER_TEXT} Scan Trade n&apos;est ni un conseiller en investissement financier, ni un prestataire de
        services d&apos;investissement. Aucune analyse produite ne constitue une recommandation personnalisée.
      </LegalSection>

      <LegalSection title="3. Ce que le service ne fait pas">
        Scan Trade ne se connecte à aucun courtier, ne transmet aucun ordre, n&apos;exécute aucune opération et ne
        gère aucun capital. Le service ne publie ni taux de réussite, ni performance passée, ni témoignage.
      </LegalSection>

      <LegalSection title="4. Limites de l'analyse d'une image">
        L&apos;analyse repose exclusivement sur ce qui est visible dans la capture fournie. Une image illisible,
        tronquée, trop zoomée ou dépourvue d&apos;échelle de prix peut conduire le service à refuser de produire un
        scénario. Ce refus fait partie du fonctionnement normal du produit.
      </LegalSection>

      <LegalSection title="5. Compte et abonnement">
        L&apos;accès aux analyses nécessite un compte et un abonnement Scan Trade Pro actif, facturé 19,90 € TTC par
        mois via Stripe. L&apos;abonnement est résiliable à tout moment depuis l&apos;espace client ; l&apos;accès
        est maintenu jusqu&apos;au terme de la période déjà réglée. Aucune donnée bancaire n&apos;est conservée par
        Scan Trade.
      </LegalSection>

      <LegalSection title="6. Utilisation acceptable">
        L&apos;utilisateur s&apos;engage à ne pas contourner les limitations techniques du service, à ne pas
        automatiser l&apos;envoi massif de requêtes et à n&apos;importer que des images dont il dispose légitimement.
      </LegalSection>

      <LegalSection title="7. Responsabilité">
        L&apos;utilisateur reste seul décisionnaire et seul responsable de ses opérations de marché. La
        responsabilité de Scan Trade ne saurait être engagée au titre de pertes résultant de décisions prises à la
        lecture d&apos;une analyse.
      </LegalSection>

      <LegalSection title="8. Suppression du compte">
        Le compte peut être supprimé à tout moment depuis les paramètres. La suppression est définitive et entraîne
        l&apos;effacement des analyses, des captures associées et la résiliation de l&apos;abonnement en cours.
      </LegalSection>
    </LegalPage>
  );
}
