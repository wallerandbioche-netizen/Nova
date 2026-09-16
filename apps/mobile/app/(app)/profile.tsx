import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { EXPERIENCE_LABELS, INVESTMENT_GOAL_LABELS, INVESTMENT_HORIZON_LABELS } from '@nova/config';
import { Badge, Button, Card, ListRow, Screen, SectionHeader, Text, useTheme } from '@nova/ui';
import { useAuth } from '../../src/state/auth-context';

/**
 * Profile hub.
 *
 * Gives access to everything that is not a daily-use screen: investor profile, journal,
 * notifications, settings, subscription and help.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, investorProfile, subscription } = useAuth();

  return (
    <Screen title={user?.firstName ? `Bonjour, ${user.firstName}` : 'Profil'}>
      <View style={{ gap: theme.spacing.xl }}>
        <Card>
          <View style={{ gap: theme.spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text variant="smallStrong" color="secondary">
                Votre profil investisseur
              </Text>
              <Badge
                label={subscription?.plan === 'premium' ? 'NOVA Premium' : 'NOVA'}
                tone={subscription?.plan === 'premium' ? 'accent' : 'neutral'}
              />
            </View>

            {investorProfile ? (
              <View style={{ gap: theme.spacing.xs }}>
                <Line
                  label="Objectif"
                  value={INVESTMENT_GOAL_LABELS[investorProfile.investmentGoal]}
                />
                <Line
                  label="Horizon"
                  value={INVESTMENT_HORIZON_LABELS[investorProfile.investmentHorizon]}
                />
                <Line
                  label="Expérience"
                  value={EXPERIENCE_LABELS[investorProfile.experienceLevel]}
                />
              </View>
            ) : (
              <Text variant="small" color="secondary">
                Votre profil investisseur n’est pas encore renseigné.
              </Text>
            )}

            <Button
              label="Modifier mon profil"
              variant="secondary"
              onPress={() => router.push('/settings/investor-profile')}
            />
          </View>
        </Card>

        <View>
          <SectionHeader title="Votre activité" />
          <Card>
            <ListRow
              label="Journal d’investissement"
              description="Vos décisions et les raisons qui les ont motivées"
              onPress={() => router.push('/journal')}
            />
            <Divider />
            <ListRow
              label="Notifications"
              description="Ce que NOVA vous a signalé"
              onPress={() => router.push('/notifications')}
            />
            <Divider />
            <ListRow
              label="Historique des briefings"
              onPress={() => router.push('/brief/history')}
            />
          </Card>
        </View>

        <View>
          <SectionHeader title="Réglages" />
          <Card>
            <ListRow label="Paramètres" onPress={() => router.push('/settings')} />
            <Divider />
            <ListRow label="Sécurité" onPress={() => router.push('/settings/security')} />
            <Divider />
            <ListRow
              label="Abonnement"
              value={subscription?.plan === 'premium' ? 'Premium' : 'Gratuit'}
              onPress={() => router.push('/settings/subscription')}
            />
          </Card>
        </View>

        <View>
          <SectionHeader title="À propos" />
          <Card>
            <ListRow label="Aide et fonctionnement" onPress={() => router.push('/help')} />
            <Divider />
            <ListRow
              label="Conditions d’utilisation"
              onPress={() => router.push('/(public)/terms')}
            />
            <Divider />
            <ListRow
              label="Politique de confidentialité"
              onPress={() => router.push('/(public)/privacy')}
            />
          </Card>
        </View>

        <Text variant="caption" color="tertiary" align="center">
          NOVA fournit une information pédagogique et contextuelle. NOVA ne délivre pas de conseil
          en investissement personnalisé.
        </Text>
      </View>
    </Screen>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
      <Text variant="small" color="secondary">
        {label}
      </Text>
      <Text variant="smallStrong">{value}</Text>
    </View>
  );
}

function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.colors.border }} />;
}
